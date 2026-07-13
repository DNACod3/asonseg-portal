import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração do participante `hideCandidateProfileForRevocation`
 * (USP-053 / CAND-7 — OCULTAR). Requer Postgres local (`supabase start`) e
 * `DATABASE_URL` no env. O helper recebe uma `tx` do chamador (a revogação de
 * `JOB_APPLICATION`); os testes abrem uma transação manual para simular o
 * contexto do chamador (mesmo padrão de `ensure-candidate-role.int.test.ts`).
 *
 * Cobre USP053-02 (ACTIVE→PAUSED, ausente de `searchCandidates`), USP053-E2
 * (perfil não-ACTIVE/ausente = no-op), USP053-MN-02 (perfil não pode seguir
 * retornável), USP053-MN-03 (campos preservados, linha não apagada) e
 * USP053-MN-05 (escopo estrito por personId — outro titular intocado).
 */

const { prisma } = await import('@/shared/lib/prisma');
// Import relativo intra-módulo (não pelo barrel `@/modules/persons`): o barrel
// reexporta Server Actions ('use server') que importam `next/headers`,
// indisponível no ambiente Node do Vitest (mesmo padrão de ensure-candidate-role).
const { hideCandidateProfileForRevocation } = await import(
  '../actions/hide-candidate-profile-for-revocation'
);
const { searchCandidates } = await import('../queries/search-candidates');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

/** Ctx completo — mesmo shape de `RevocationEffectsContext` (jobs/consents). */
function ctxFor(personId: string): {
  personId: string;
  actorPersonId: string;
  ip: string | null;
  userAgent: string | null;
  justification: string;
} {
  return {
    personId,
    actorPersonId: personId,
    ip: '10.0.0.9',
    userAgent: 'vitest/int',
    justification: 'Revogação de consentimento solicitada pelo titular.',
  };
}

const responsible: CurrentPerson = {
  id: 'viewer-hide-cascade',
  supabaseUserId: '00000000-0000-0000-0000-0000000000dd',
  fullName: 'Responsável Hide Cascade Int',
  status: 'ATIVO',
  primeiroAcesso: false,
  roles: ['COMPANY_RESPONSIBLE'],
  phone: null,
  fullAddress: null,
};

skipIfNoDb('hideCandidateProfileForRevocation — integração', () => {
  let activePersonId = ''; // ACTIVE — vira PAUSED (USP053-02/MN-02)
  let draftPersonId = ''; // DRAFT — no-op (E2)
  let noProfilePersonId = ''; // sem CandidateProfile — no-op (E2)
  let otherActivePersonId = ''; // ACTIVE de OUTRO titular — deve seguir intocado (MN-05)

  async function cleanup() {
    const ids = [activePersonId, draftPersonId, noProfilePersonId, otherActivePersonId].filter(Boolean);
    if (ids.length > 0) {
      await prisma.candidateProfile.deleteMany({ where: { personId: { in: ids } } });
      await prisma.person.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.person.deleteMany({ where: { fullName: { startsWith: 'Hide Cascade Int' } } });
  }

  beforeAll(async () => {
    const active = await prisma.person.create({
      data: { fullName: 'Hide Cascade Int Ativo', status: 'ATIVO' },
      select: { id: true },
    });
    activePersonId = active.id;
    await prisma.candidateProfile.create({
      data: {
        personId: activePersonId,
        publicationStatus: 'ACTIVE',
        headline: 'Headline Hide Cascade Int',
        skillsText: 'Skills Hide Cascade Int',
      },
    });

    const draft = await prisma.person.create({
      data: { fullName: 'Hide Cascade Int Draft', status: 'ATIVO' },
      select: { id: true },
    });
    draftPersonId = draft.id;
    await prisma.candidateProfile.create({
      data: { personId: draftPersonId, publicationStatus: 'DRAFT' },
    });

    const noProfile = await prisma.person.create({
      data: { fullName: 'Hide Cascade Int Sem Perfil', status: 'ATIVO' },
      select: { id: true },
    });
    noProfilePersonId = noProfile.id;

    const otherActive = await prisma.person.create({
      data: { fullName: 'Hide Cascade Int Outro Titular', status: 'ATIVO' },
      select: { id: true },
    });
    otherActivePersonId = otherActive.id;
    await prisma.candidateProfile.create({
      data: { personId: otherActivePersonId, publicationStatus: 'ACTIVE' },
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it('USP053-02/MN-02: perfil ACTIVE vira PAUSED e some de searchCandidates', async () => {
    const before = await searchCandidates({}, responsible);
    expect(before.ok).toBe(true);
    if (before.ok) expect(before.data.items.map((i) => i.candidatePersonId)).toContain(activePersonId);

    const result = await prisma.$transaction(async (tx) =>
      hideCandidateProfileForRevocation(tx, ctxFor(activePersonId)),
    );
    expect(result).toEqual({ hidden: true });

    const profile = await prisma.candidateProfile.findUnique({
      where: { personId: activePersonId },
      select: { publicationStatus: true, headline: true, skillsText: true },
    });
    expect(profile?.publicationStatus).toBe('PAUSED');
    // USP053-MN-03: demais campos preservados, linha não apagada.
    expect(profile?.headline).toBe('Headline Hide Cascade Int');
    expect(profile?.skillsText).toBe('Skills Hide Cascade Int');

    const after = await searchCandidates({}, responsible);
    expect(after.ok).toBe(true);
    if (after.ok) expect(after.data.items.map((i) => i.candidatePersonId)).not.toContain(activePersonId);

    // Remediação Fase 8 (achado de segurança do /pr-review): a transição agora
    // grava seu PRÓPRIO evento de auditoria (antes só existia um `profileHidden`
    // solto dentro do `CONSENT_REVOKED`) — investigável por
    // `entityType='CANDIDATE_PROFILE' AND entityId=<personId>`.
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CANDIDATE_PROFILE_PAUSED', entityType: 'CANDIDATE_PROFILE', entityId: activePersonId },
      select: { before: true, after: true, actorPersonId: true, ip: true, userAgent: true },
    });
    expect(audit).toMatchObject({
      before: { status: 'ACTIVE' },
      after: { status: 'PAUSED' },
      actorPersonId: activePersonId,
      ip: '10.0.0.9',
      userAgent: 'vitest/int',
    });
  });

  it('USP053-E2: perfil não-ACTIVE (DRAFT) é no-op — hidden:false, status inalterado', async () => {
    const result = await prisma.$transaction(async (tx) =>
      hideCandidateProfileForRevocation(tx, ctxFor(draftPersonId)),
    );
    expect(result).toEqual({ hidden: false });

    const profile = await prisma.candidateProfile.findUnique({
      where: { personId: draftPersonId },
      select: { publicationStatus: true },
    });
    expect(profile?.publicationStatus).toBe('DRAFT');
  });

  it('USP053-E2: titular sem CandidateProfile é no-op — hidden:false, sem erro', async () => {
    const result = await prisma.$transaction(async (tx) =>
      hideCandidateProfileForRevocation(tx, ctxFor(noProfilePersonId)),
    );
    expect(result).toEqual({ hidden: false });

    const profile = await prisma.candidateProfile.findUnique({ where: { personId: noProfilePersonId } });
    expect(profile).toBeNull();
  });

  it('USP053-MN-05: oculta só o titular — perfil ACTIVE de outra Pessoa segue intocado', async () => {
    const result = await prisma.$transaction(async (tx) =>
      hideCandidateProfileForRevocation(tx, ctxFor(draftPersonId)),
    );
    expect(result).toEqual({ hidden: false });

    const other = await prisma.candidateProfile.findUnique({
      where: { personId: otherActivePersonId },
      select: { publicationStatus: true },
    });
    expect(other?.publicationStatus).toBe('ACTIVE');
  });
});
