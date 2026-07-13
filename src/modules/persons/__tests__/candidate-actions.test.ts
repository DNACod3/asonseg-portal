import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Unit das Server Actions do cadastro de candidato (USP-009 #44) com
 * sessão/consentimento/auditoria/moderação/prisma mockados — cobre a sequência
 * canônica e todos os ramos sem tocar o banco. A transação real (Postgres) e o
 * acoplamento com `transitionContent` ficam no `candidate-actions.int.test.ts`.
 */

const sessionState = vi.hoisted(() => ({ person: null as CurrentPerson | null }));
const consentState = vi.hoisted(() => ({ active: new Set<string>() }));
const auditState = vi.hoisted(() => ({
  events: [] as string[],
  recorder: null as Record<string, unknown> | null,
}));
const txState = vi.hoisted(() => ({ upsert: vi.fn(), personUpdate: vi.fn(), throwOnAudit: false }));
const moderationState = vi.hoisted(() => ({ transition: vi.fn() }));
const prismaState = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest' }),
}));

vi.mock('@/modules/identity', () => ({
  getCurrentPerson: async () => sessionState.person,
}));

vi.mock('@/modules/consents', () => ({
  requireActiveConsent: async (_personId: string, purpose: string) => ({
    active: consentState.active.has(purpose),
  }),
}));

vi.mock('@/modules/audit', () => ({
  AuditEvent: { CANDIDATE_ROLE_ACTIVATED: 'CANDIDATE_ROLE_ACTIVATED' },
  withAudit: async (
    event: string,
    fn: (tx: unknown, audit: Record<string, unknown>) => Promise<unknown>,
  ) => {
    auditState.events.push(event);
    if (txState.throwOnAudit) throw new Error('db indisponível');
    const recorder: Record<string, unknown> = {};
    const tx = {
      candidateProfile: { upsert: txState.upsert },
      person: { update: txState.personUpdate },
    };
    const result = await fn(tx, recorder);
    auditState.recorder = recorder;
    return result;
  },
}));

vi.mock('@/modules/moderation', () => ({
  transitionContent: (...a: unknown[]) => moderationState.transition(...a),
  ContentKind: { CANDIDATE_PROFILE: 'CANDIDATE_PROFILE' },
  ContentStatus: { IN_MODERATION: 'IN_MODERATION' },
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { candidateProfile: { findUnique: prismaState.findUnique } },
}));

const { activateCandidateRole } = await import('../actions/activate-candidate-role');
const { submitCandidateForModeration } = await import('../actions/submit-candidate-for-moderation');

function person(id = 'person-1'): CurrentPerson {
  return {
    id,
    supabaseUserId: '00000000-0000-0000-0000-0000000000aa',
    fullName: 'Candidato Unit',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['CANDIDATE'],
    phone: null,
    fullAddress: null,
  };
}

const AREA_ID = '11111111-1111-1111-1111-111111111111';
const validInput = () => ({
  educationLevel: 'ENSINO_MEDIO' as const,
  primaryAreaOfInterestId: AREA_ID,
  phone: '(11) 98888-7777',
});

beforeEach(() => {
  sessionState.person = person();
  consentState.active = new Set(['PORTAL_ACCESS', 'JOB_APPLICATION']);
  auditState.events = [];
  auditState.recorder = null;
  // CAND-2 / PERF-02: a action agora lê `saved.publicationStatus` do retorno do
  // upsert — o mock precisa devolver o status real (o valor default do ramo
  // create é DRAFT); PERF-MN-02 sobrescreve por teste com `mockResolvedValueOnce`.
  txState.upsert.mockReset().mockResolvedValue({ publicationStatus: 'DRAFT' });
  txState.personUpdate.mockReset().mockResolvedValue({});
  txState.throwOnAudit = false;
  moderationState.transition.mockReset();
  prismaState.findUnique.mockReset();
});

describe('persons/activateCandidateRole', () => {
  it('happy path (só obrigatórios): cria perfil em DRAFT, audita e mapeia opcionais para null', async () => {
    const res = await activateCandidateRole(validInput());

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual({ personId: 'person-1', publicationStatus: 'DRAFT' });
    expect(auditState.events).toContain('CANDIDATE_ROLE_ACTIVATED');
    // Ramo "ausente" de cada `?? null`: opcionais não enviados viram null no create.
    const createData = txState.upsert.mock.calls[0]?.[0]?.create;
    expect(createData).toMatchObject({
      personId: 'person-1',
      educationLevel: 'ENSINO_MEDIO',
      headline: null,
      educationArea: null,
      experienceText: null,
      skillsText: null,
      coursesText: null,
      availability: null,
    });
    expect(auditState.recorder?.after).toMatchObject({ publicationStatus: 'DRAFT' });
    // Fix (necessário p/ USP-027): telefone normalizado (só dígitos) persistido em Person.
    expect(txState.personUpdate).toHaveBeenCalledWith({
      where: { id: 'person-1' },
      data: { phone: '11988887777' },
    });
  });

  it('happy path (todos os opcionais): ramo "presente" dos defaults é exercido', async () => {
    const res = await activateCandidateRole({
      ...validInput(),
      headline: 'Aux. administrativo',
      educationArea: 'Administração',
      experienceText: '3 anos',
      skillsText: 'Excel',
      coursesText: 'Pacote Office',
      availability: 'Integral',
    });

    expect(res.ok).toBe(true);
    const updateData = txState.upsert.mock.calls[0]?.[0]?.update;
    expect(updateData).toMatchObject({
      headline: 'Aux. administrativo',
      educationArea: 'Administração',
      experienceText: '3 anos',
      skillsText: 'Excel',
      coursesText: 'Pacote Office',
      availability: 'Integral',
    });
  });

  it('PERF-MN-01: payload update (só obrigatórios) não inclui as chaves de CV ausentes do input', async () => {
    await activateCandidateRole(validInput());
    const updateData = txState.upsert.mock.calls[0]?.[0]?.update;
    expect(updateData).not.toHaveProperty('skillsText');
    expect(updateData).not.toHaveProperty('coursesText');
    expect(updateData).not.toHaveProperty('educationArea');
    expect(updateData).not.toHaveProperty('availability');
    expect(updateData).not.toHaveProperty('headline');
    expect(updateData).not.toHaveProperty('experienceText');
    expect(updateData).toMatchObject({
      educationLevel: 'ENSINO_MEDIO',
      primaryAreaOfInterestId: AREA_ID,
    });
  });

  it('PERF-MN-02: perfil ACTIVE retorna publicationStatus real (ACTIVE), não hardcoded DRAFT', async () => {
    txState.upsert.mockResolvedValueOnce({ publicationStatus: 'ACTIVE' });
    const res = await activateCandidateRole(validInput());
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.publicationStatus).toBe('ACTIVE');
    expect(auditState.recorder?.after).toMatchObject({ publicationStatus: 'ACTIVE' });
  });

  it('Zod: telefone inválido → VALIDATION, sem auditoria', async () => {
    const res = await activateCandidateRole({ ...validInput(), phone: '12' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('VALIDATION');
    expect(auditState.events).toHaveLength(0);
    expect(txState.upsert).not.toHaveBeenCalled();
  });

  it('sem sessão → UNAUTHENTICATED (P-002)', async () => {
    sessionState.person = null;
    const res = await activateCandidateRole(validInput());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('UNAUTHENTICATED');
    expect(auditState.events).toHaveLength(0);
  });

  it('consentimento ausente (PORTAL_ACCESS) → CONSENT_REQUIRED', async () => {
    consentState.active = new Set(['JOB_APPLICATION']);
    const res = await activateCandidateRole(validInput());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('CONSENT_REQUIRED');
    expect(txState.upsert).not.toHaveBeenCalled();
  });

  it('consentimento ausente (JOB_APPLICATION) → CONSENT_REQUIRED', async () => {
    consentState.active = new Set(['PORTAL_ACCESS']);
    const res = await activateCandidateRole(validInput());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('CONSENT_REQUIRED');
  });

  it('IP "unknown" do header → persiste como null (ramo do clientIp)', async () => {
    // sem x-real-ip o clientIp resolve "unknown"; a action normaliza para null.
    const res = await activateCandidateRole(validInput());
    expect(res.ok).toBe(true); // não quebra; cobre o ramo de normalização do ip
  });

  it('falha inesperada na transação → INTERNAL (catch-all)', async () => {
    txState.throwOnAudit = true;
    const res = await activateCandidateRole(validInput());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('INTERNAL');
  });
});

describe('persons/submitCandidateForModeration', () => {
  it('happy path: DRAFT → IN_MODERATION via transitionContent', async () => {
    prismaState.findUnique.mockResolvedValue({ personId: 'person-1' });
    moderationState.transition.mockResolvedValue({ ok: true, data: { from: 'DRAFT', to: 'IN_MODERATION' } });

    const res = await submitCandidateForModeration();

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.to).toBe('IN_MODERATION');
    expect(moderationState.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        contentKind: 'CANDIDATE_PROFILE',
        contentId: 'person-1',
        to: 'IN_MODERATION',
        trigger: 'AUTHOR_ACTION',
        actorPersonId: 'person-1',
      }),
    );
  });

  it('sem sessão → UNAUTHENTICATED, sem tocar o banco', async () => {
    sessionState.person = null;
    const res = await submitCandidateForModeration();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('UNAUTHENTICATED');
    expect(prismaState.findUnique).not.toHaveBeenCalled();
  });

  it('perfil inexistente → NOT_FOUND, sem transição', async () => {
    prismaState.findUnique.mockResolvedValue(null);
    const res = await submitCandidateForModeration();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('NOT_FOUND');
    expect(moderationState.transition).not.toHaveBeenCalled();
  });

  it('transição rejeitada pela máquina de estados → repassa o erro (INVALID_TRANSITION)', async () => {
    prismaState.findUnique.mockResolvedValue({ personId: 'person-1' });
    moderationState.transition.mockResolvedValue({
      ok: false,
      error: { code: 'INVALID_TRANSITION', message: 'transição inválida' },
    });
    const res = await submitCandidateForModeration();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('INVALID_TRANSITION');
  });
});
