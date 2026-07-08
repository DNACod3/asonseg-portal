import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `confirmCvFields` (USP-040 / CVE-04, T14). Requer
 * Postgres local (`supabase start`).
 *
 * Real: Prisma/Postgres + `audit_log`. Mock: `getCurrentPerson` (sessão).
 * Cobre: persistência dos 5 campos + `cvLastConfirmedAt` + auditoria
 * `CV_USER_CONFIRMED_FIELDS`; **CVE-MN-01 (companion)** — nada gravado antes
 * da confirmação, só este caminho grava; validação Zod; não autenticado; sem
 * perfil de candidato.
 */

let mockPerson: CurrentPerson | null = null;
vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { confirmCvFields } = await import('../actions/confirm-cv-fields');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

function baseMockPerson(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: '00000000-0000-0000-0000-0000000000ee',
    fullName: 'Candidato Confirmação Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['CANDIDATE'],
    phone: null,
    fullAddress: null,
  };
}

const CONFIRM_INPUT = {
  educationLevel: 'ENSINO_SUPERIOR' as const,
  educationArea: 'Administração',
  experienceText: '5 anos como auxiliar administrativo',
  skillsText: 'Excel, atendimento ao público',
  coursesText: 'Curso de Excel avançado',
};

skipIfNoDb('USP-040 / CVE-04 — confirmCvFields (integração)', () => {
  let personId = '';
  let personNoProfileId = '';

  beforeAll(async () => {
    const person = await prisma.person.create({
      data: { fullName: 'Candidato Confirmação Int', status: 'ATIVO' },
      select: { id: true },
    });
    personId = person.id;
    await prisma.candidateProfile.create({ data: { personId } });

    const noProfile = await prisma.person.create({
      data: { fullName: 'Candidato Sem Perfil Confirmação Int', status: 'ATIVO' },
      select: { id: true },
    });
    personNoProfileId = noProfile.id;
  });

  afterAll(async () => {
    await prisma.candidateProfile.deleteMany({ where: { personId } });
    await prisma.person.deleteMany({ where: { id: { in: [personId, personNoProfileId] } } });
  });

  it('CVE-MN-01 (companion): antes de confirmar, os campos estruturados estão vazios', async () => {
    const profile = await prisma.candidateProfile.findUnique({
      where: { personId },
      select: { educationLevel: true, cvLastConfirmedAt: true },
    });
    expect(profile?.educationLevel).toBeNull();
    expect(profile?.cvLastConfirmedAt).toBeNull();
  });

  it('CVE-04 happy path: persiste os 5 campos + cvLastConfirmedAt + audita CV_USER_CONFIRMED_FIELDS', async () => {
    mockPerson = baseMockPerson(personId);

    const res = await confirmCvFields(CONFIRM_INPUT);
    expect(res.ok).toBe(true);

    const profile = await prisma.candidateProfile.findUnique({
      where: { personId },
      select: {
        educationLevel: true,
        educationArea: true,
        experienceText: true,
        skillsText: true,
        coursesText: true,
        cvLastConfirmedAt: true,
      },
    });
    expect(profile).toMatchObject(CONFIRM_INPUT);
    expect(profile?.cvLastConfirmedAt).toBeInstanceOf(Date);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CV_USER_CONFIRMED_FIELDS', actorPersonId: personId },
    });
    expect(audit).not.toBeNull();
  });

  it('validação Zod: rejeita educationLevel fora do enum', async () => {
    mockPerson = baseMockPerson(personId);

    const res = await confirmCvFields({ educationLevel: 'DOUTORADO' as never });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('VALIDATION');
  });

  it('não autenticado: bloqueia com UNAUTHENTICATED', async () => {
    mockPerson = null;

    const res = await confirmCvFields(CONFIRM_INPUT);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('UNAUTHENTICATED');
  });

  it('precondição: sem candidate_profiles bloqueia com PRECONDITION_FAILED', async () => {
    mockPerson = baseMockPerson(personNoProfileId);

    const res = await confirmCvFields(CONFIRM_INPUT);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('PRECONDITION_FAILED');
  });
});
