import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração das Server Actions do cadastro de candidato (USP-009 #44).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Real: Prisma/Postgres — persistência do CandidateProfile, guarda de consentimento
 * e a transição DRAFT→IN_MODERATION via `transitionContent` (adapter de candidato no
 * dispatcher por ContentKind). Mocks: next/headers, session (pessoa autenticada),
 * e os side effects de moderação (notificação/cache/hook) como no-op.
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.2', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;
vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { container } = await import('@/shared/container');
const { MODERATION_NOTIFICATION_TOKEN } = await import(
  '@/modules/moderation/ports/moderation-notification.port'
);
const { CACHE_INVALIDATION_TOKEN } = await import('@/modules/moderation/ports/cache-invalidation.port');
const { COMPANY_VERIFY_HOOK_TOKEN } = await import('@/modules/moderation/ports/company-verify-hook.port');
const { activateCandidateRole } = await import('../actions/activate-candidate-role');
const { submitCandidateForModeration } = await import('../actions/submit-candidate-for-moderation');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('USP-009 #44 — cadastro de candidato (integração)', () => {
  let personId = '';
  let personNoConsentId = '';
  let jobAreaId = '';

  const baseInput = () => ({
    educationLevel: 'ENSINO_MEDIO' as const,
    primaryAreaOfInterestId: jobAreaId,
    phone: '(11) 98888-7777',
    headline: 'Auxiliar administrativo',
  });

  beforeAll(async () => {
    // Side effects de moderação como no-op (evita chamadas ao Next fora de request).
    container.register(MODERATION_NOTIFICATION_TOKEN, () => ({ sendModerationDecision: vi.fn() }));
    container.register(CACHE_INVALIDATION_TOKEN, () => ({ revalidateForContent: vi.fn() }));
    container.register(COMPANY_VERIFY_HOOK_TOKEN, () => ({
      onContentActivated: vi.fn(),
      onContentRejected: vi.fn(),
    }));

    const area = await prisma.jobArea.create({
      data: { name: `Área Teste USP009 ${Date.now()}` },
      select: { id: true },
    });
    jobAreaId = area.id;

    const person = await prisma.person.create({
      data: { fullName: 'Candidato Int', status: 'ATIVO' },
      select: { id: true },
    });
    personId = person.id;
    await prisma.consent.createMany({
      data: [
        { personId, purpose: 'PORTAL_ACCESS', termVersion: 'v1.0', termContentHash: 'x' },
        { personId, purpose: 'JOB_APPLICATION', termVersion: 'v1.0', termContentHash: 'x' },
      ],
    });

    const p2 = await prisma.person.create({
      data: { fullName: 'Sem Consent Int', status: 'ATIVO' },
      select: { id: true },
    });
    personNoConsentId = p2.id;
    await prisma.consent.create({
      data: { personId: personNoConsentId, purpose: 'PORTAL_ACCESS', termVersion: 'v1.0', termContentHash: 'x' },
    });

    mockPerson = baseMockPerson(personId);
  });

  afterAll(async () => {
    await prisma.candidateProfile.deleteMany({ where: { personId: { in: [personId, personNoConsentId] } } });
    await prisma.consent.deleteMany({ where: { personId: { in: [personId, personNoConsentId] } } });
    await prisma.person.deleteMany({ where: { id: { in: [personId, personNoConsentId] } } });
    await prisma.jobArea.deleteMany({ where: { id: jobAreaId } });
  });

  function baseMockPerson(id: string): CurrentPerson {
    return {
      id,
      supabaseUserId: '00000000-0000-0000-0000-0000000000aa',
      fullName: 'Candidato Int',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles: ['CANDIDATE'],
      phone: null,
      fullAddress: null,
    };
  }

  it('CAD-01 happy path: cria CandidateProfile em DRAFT', async () => {
    mockPerson = baseMockPerson(personId);
    const res = await activateCandidateRole(baseInput());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.publicationStatus).toBe('DRAFT');
    const profile = await prisma.candidateProfile.findUnique({ where: { personId } });
    expect(profile?.publicationStatus).toBe('DRAFT');
    expect(profile?.educationLevel).toBe('ENSINO_MEDIO');
  });

  it('CAD-01/USP-027 persiste o telefone normalizado em Person.phone', async () => {
    mockPerson = baseMockPerson(personId);
    const res = await activateCandidateRole(baseInput());
    expect(res.ok).toBe(true);
    const person = await prisma.person.findUnique({ where: { id: personId }, select: { phone: true } });
    expect(person?.phone).toBe('11988887777'); // normalizado (só dígitos) — '(11) 98888-7777' de baseInput()
  });

  it('CAND-1 / PERF-MN-01: update com só obrigatórios preserva campos de CV já persistidos', async () => {
    mockPerson = baseMockPerson(personId);
    await prisma.candidateProfile.update({
      where: { personId },
      data: {
        skillsText: 'Excel avançado',
        coursesText: 'Curso de Excel',
        educationArea: 'Administração',
        availability: 'Integral',
      },
    });

    const res = await activateCandidateRole({
      educationLevel: 'ENSINO_SUPERIOR',
      primaryAreaOfInterestId: jobAreaId,
      phone: '(11) 97777-6666',
    });

    expect(res.ok).toBe(true);
    const profile = await prisma.candidateProfile.findUnique({ where: { personId } });
    expect(profile?.skillsText).toBe('Excel avançado');
    expect(profile?.coursesText).toBe('Curso de Excel');
    expect(profile?.educationArea).toBe('Administração');
    expect(profile?.availability).toBe('Integral');
    // Os campos gerenciados pelo formulário foram atualizados normalmente.
    expect(profile?.educationLevel).toBe('ENSINO_SUPERIOR');
  });

  it('CAD-01 validação Zod: rejeita telefone inválido', async () => {
    mockPerson = baseMockPerson(personId);
    const res = await activateCandidateRole({ ...baseInput(), phone: '12' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('VALIDATION');
  });

  it('CAD-01 permissão: recusa não autenticado', async () => {
    mockPerson = null;
    const res = await activateCandidateRole(baseInput());
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('UNAUTHENTICATED');
  });

  it('CAD-05 consentimento ausente: bloqueia com CONSENT_REQUIRED', async () => {
    mockPerson = baseMockPerson(personNoConsentId);
    const res = await activateCandidateRole(baseInput());
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('CONSENT_REQUIRED');
  });

  it('CAD-01 idempotência: reativar não duplica o perfil', async () => {
    mockPerson = baseMockPerson(personId);
    await activateCandidateRole({ ...baseInput(), headline: 'Atualizado' });
    const count = await prisma.candidateProfile.count({ where: { personId } });
    expect(count).toBe(1);
  });

  it('CAD-03 permissão: recusa não autenticado (UNAUTHENTICATED)', async () => {
    mockPerson = null;
    const res = await submitCandidateForModeration();
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('UNAUTHENTICATED');
  });

  it('CAD-03 pré-condição: perfil inexistente é rejeitado (NOT_FOUND)', async () => {
    mockPerson = baseMockPerson(personNoConsentId); // pessoa sem CandidateProfile
    const res = await submitCandidateForModeration();
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('NOT_FOUND');
  });

  it('CAD-03 happy path: envia para moderação (DRAFT → IN_MODERATION)', async () => {
    mockPerson = baseMockPerson(personId);
    const res = await submitCandidateForModeration();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.to).toBe('IN_MODERATION');
    const profile = await prisma.candidateProfile.findUnique({ where: { personId } });
    expect(profile?.publicationStatus).toBe('IN_MODERATION');
  });

  it('CAD-03 borda: reenviar de IN_MODERATION é rejeitado (INVALID_TRANSITION)', async () => {
    mockPerson = baseMockPerson(personId);
    const res = await submitCandidateForModeration();
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('INVALID_TRANSITION');
  });
});
