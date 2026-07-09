import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Testes de integração do helper `ensureCandidateRole` (USP-037 / AC-037-2).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env. Espelha
 * `ensure-client-role.int.test.ts`, mas cobre a divergência documentada: SEM
 * gate `PORTAL_ACCESS` (EC-2 — Pessoa sem credencial/e-mail precisa ser
 * encaminhável). O helper recebe uma `tx` do chamador; os testes abrem uma
 * transação manual para simular o contexto do chamador (`createReferral`).
 */

const { prisma } = await import('@/shared/lib/prisma');
// Import relativo intra-módulo (não pelo barrel `@/modules/persons`): o barrel
// reexporta Server Actions ('use server') que importam `next/headers`,
// indisponível no ambiente Node do Vitest (mesmo padrão de ensure-client-role).
const { ensureCandidateRole } = await import('../actions/ensure-candidate-role');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const TERM = { version: 'social-referral-to-job@v1.0', hash: 'sha256-test-stub' };
const IP = '127.0.0.1';
const UA = 'vitest/int';

skipIfNoDb('USP-037 — ensureCandidateRole (integração)', () => {
  let personNoCredentialId = ''; // sem emailLogin/sem PORTAL_ACCESS (EC-2)
  let personAlreadyCandidateId = ''; // papel já ativo (idempotência)

  beforeAll(async () => {
    // Pessoa SEM credencial (sem emailLogin, sem consent PORTAL_ACCESS) — cadastro
    // assistido pela AS sem e-mail. O helper deve funcionar mesmo assim (EC-2).
    const p1 = await prisma.person.create({
      data: { fullName: 'CandRef Int Sem Credencial', status: 'ATIVO' },
      select: { id: true },
    });
    personNoCredentialId = p1.id;

    // Pessoa já com papel CANDIDATE ativo (para testar idempotência)
    const p2 = await prisma.person.create({
      data: { fullName: 'CandRef Int Já Candidato', status: 'ATIVO' },
      select: { id: true },
    });
    personAlreadyCandidateId = p2.id;
    await prisma.consent.create({
      data: {
        personId: personAlreadyCandidateId,
        purpose: 'SOCIAL_REFERRAL_TO_JOB',
        termVersion: TERM.version,
        termContentHash: TERM.hash,
      },
    });
    const grant = await prisma.personRoleGrant.create({
      data: { personId: personAlreadyCandidateId, role: 'CANDIDATE', status: 'ACTIVE' },
      select: { id: true },
    });
    await prisma.candidateProfile.create({ data: { personId: personAlreadyCandidateId } });
    await prisma.auditLog.create({
      data: {
        action: 'CANDIDATE_ROLE_ACTIVATED',
        actorPersonId: personAlreadyCandidateId,
        entityType: 'person_role_grant',
        entityId: grant.id,
        after: { role: 'CANDIDATE', status: 'ACTIVE', via: 'seed' },
      },
    });
  });

  afterAll(async () => {
    const ids = [personNoCredentialId, personAlreadyCandidateId];
    // auditLog é append-only (ADR-0023) — trigger de DB bloqueia DELETE; não limpar.
    await prisma.candidateProfile.deleteMany({ where: { personId: { in: ids } } });
    await prisma.personRoleGrant.deleteMany({ where: { personId: { in: ids } } });
    await prisma.consent.deleteMany({ where: { personId: { in: ids } } });
    await prisma.person.deleteMany({ where: { id: { in: ids } } });
  });

  it('@ac-037-2 EC-2: Pessoa sem emailLogin/sem PORTAL_ACCESS → ativa CANDIDATE, cria CandidateProfile e consent tácito', async () => {
    const result = await prisma.$transaction(async (tx) => {
      return ensureCandidateRole(tx, { personId: personNoCredentialId, term: TERM, ip: IP, userAgent: UA });
    });
    expect(result.activated).toBe(true);
    expect(result.grantId).toBeTruthy();

    const grant = await prisma.personRoleGrant.findFirst({
      where: { personId: personNoCredentialId, role: 'CANDIDATE', status: 'ACTIVE' },
    });
    expect(grant).not.toBeNull();

    const profile = await prisma.candidateProfile.findUnique({ where: { personId: personNoCredentialId } });
    expect(profile).not.toBeNull();
    expect(profile?.publicationStatus).toBe('DRAFT');

    const consent = await prisma.consent.findFirst({
      where: { personId: personNoCredentialId, purpose: 'SOCIAL_REFERRAL_TO_JOB', revokedAt: null },
    });
    expect(consent).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { actorPersonId: personNoCredentialId, action: 'CANDIDATE_ROLE_ACTIVATED' },
    });
    expect(audit).not.toBeNull();

    // Confirma que PORTAL_ACCESS continua ausente — a ativação não o exigiu nem o criou.
    const portal = await prisma.consent.findFirst({
      where: { personId: personNoCredentialId, purpose: 'PORTAL_ACCESS' },
    });
    expect(portal).toBeNull();
  });

  it('consent SOCIAL_REFERRAL_TO_JOB persistido com termVersion/termContentHash/IP corretos', async () => {
    const consent = await prisma.consent.findFirst({
      where: { personId: personNoCredentialId, purpose: 'SOCIAL_REFERRAL_TO_JOB', revokedAt: null },
    });
    expect(consent?.termVersion).toBe(TERM.version);
    expect(consent?.termContentHash).toBe(TERM.hash);
    expect(consent?.acceptedIp).toBe(IP);
    expect(consent?.userAgent).toBe(UA);
    expect(consent?.acceptedAt).toBeTruthy();
  });

  it('idempotência: reexecução é no-op quando CANDIDATE já está ativo', async () => {
    const result = await prisma.$transaction(async (tx) => {
      return ensureCandidateRole(tx, { personId: personAlreadyCandidateId, term: TERM, ip: IP, userAgent: UA });
    });
    expect(result.activated).toBe(false);

    const grantCount = await prisma.personRoleGrant.count({
      where: { personId: personAlreadyCandidateId, role: 'CANDIDATE' },
    });
    expect(grantCount).toBe(1);

    const consentCount = await prisma.consent.count({
      where: { personId: personAlreadyCandidateId, purpose: 'SOCIAL_REFERRAL_TO_JOB', revokedAt: null },
    });
    expect(consentCount).toBe(1);
  });

  it('auditoria condicional: CANDIDATE_ROLE_ACTIVATED não é emitido no no-op', async () => {
    const countBefore = await prisma.auditLog.count({
      where: { actorPersonId: personAlreadyCandidateId, action: 'CANDIDATE_ROLE_ACTIVATED' },
    });
    await prisma.$transaction(async (tx) => {
      return ensureCandidateRole(tx, { personId: personAlreadyCandidateId, term: TERM, ip: null, userAgent: null });
    });
    const countAfter = await prisma.auditLog.count({
      where: { actorPersonId: personAlreadyCandidateId, action: 'CANDIDATE_ROLE_ACTIVATED' },
    });
    expect(countAfter).toBe(countBefore); // sem novo evento
  });

  it('rollback: se a tx for revertida, nenhum dado persiste', async () => {
    const testPersonId = (
      await prisma.person.create({
        data: { fullName: 'CandRef Int Rollback', status: 'ATIVO' },
        select: { id: true },
      })
    ).id;

    try {
      await prisma.$transaction(async (tx) => {
        await ensureCandidateRole(tx, { personId: testPersonId, term: TERM, ip: null, userAgent: null });
        throw new Error('rollback simulado');
      });
    } catch {
      // esperado
    }

    const grant = await prisma.personRoleGrant.findFirst({ where: { personId: testPersonId, role: 'CANDIDATE' } });
    const profile = await prisma.candidateProfile.findUnique({ where: { personId: testPersonId } });
    const consent = await prisma.consent.findFirst({
      where: { personId: testPersonId, purpose: 'SOCIAL_REFERRAL_TO_JOB' },
    });
    expect(grant).toBeNull();
    expect(profile).toBeNull();
    expect(consent).toBeNull();

    await prisma.person.delete({ where: { id: testPersonId } });
  });
});
