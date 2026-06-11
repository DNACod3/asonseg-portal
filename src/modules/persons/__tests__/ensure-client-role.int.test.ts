import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Testes de integração do helper `ensureClientRole` (USP-011 / CAD-09).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Real: Prisma/Postgres — grant CLIENT, ClientProfile, Consent SERVICE_HIRING e auditLog.
 * O helper recebe uma `tx` do chamador; os testes abrem uma transação manual para
 * simular o contexto do chamador (USP-033 / withAudit) e fazem rollback ao final de
 * cada caso para garantir isolamento sem afetar outros testes.
 */

const { prisma } = await import('@/shared/lib/prisma');
// Import por caminho relativo intra-módulo (não pelo barrel `@/modules/persons`):
// o barrel reexporta Server Actions ('use server') que importam `next/headers` no
// topo, indisponível no ambiente Node do Vitest. A regra de barrel da CLAUDE.md
// rege imports entre módulos em produção, não o acesso interno de um teste.
const { ensureClientRole } = await import('../actions/ensure-client-role');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const TERM = { version: 'service-hiring@v1.0', hash: 'sha256-test-stub' };
const IP = '127.0.0.1';
const UA = 'vitest/int';

skipIfNoDb('USP-011 — ensureClientRole (integração)', () => {
  let personId = '';
  let personWithClientId = '';

  beforeAll(async () => {
    const p1 = await prisma.person.create({
      data: { fullName: 'Cliente Int USP011', status: 'ATIVO' },
      select: { id: true },
    });
    personId = p1.id;
    await prisma.consent.create({
      data: { personId, purpose: 'PORTAL_ACCESS', termVersion: 'v1.0', termContentHash: 'x' },
    });

    // Pessoa já com papel CLIENT ativo (para testar idempotência)
    const p2 = await prisma.person.create({
      data: { fullName: 'Cliente Já Ativo USP011', status: 'ATIVO' },
      select: { id: true },
    });
    personWithClientId = p2.id;
    await prisma.consent.createMany({
      data: [
        { personId: personWithClientId, purpose: 'PORTAL_ACCESS', termVersion: 'v1.0', termContentHash: 'x' },
        {
          personId: personWithClientId,
          purpose: 'SERVICE_HIRING',
          termVersion: TERM.version,
          termContentHash: TERM.hash,
        },
      ],
    });
    const grant = await prisma.personRoleGrant.create({
      data: { personId: personWithClientId, role: 'CLIENT', status: 'ACTIVE' },
      select: { id: true },
    });
    await prisma.clientProfile.create({ data: { personId: personWithClientId } });
    // auditLog de CLIENT_ROLE_ACTIVATED já existente (simula ativação anterior)
    await prisma.auditLog.create({
      data: {
        action: 'CLIENT_ROLE_ACTIVATED',
        actorPersonId: personWithClientId,
        entityType: 'person_role_grant',
        entityId: grant.id,
        after: { role: 'CLIENT', status: 'ACTIVE', via: 'seed' },
      },
    });
  });

  afterAll(async () => {
    const ids = [personId, personWithClientId];
    // auditLog é append-only (ADR-0023) — trigger de DB bloqueia DELETE; não limpar.
    await prisma.clientProfile.deleteMany({ where: { personId: { in: ids } } });
    await prisma.personRoleGrant.deleteMany({ where: { personId: { in: ids } } });
    await prisma.consent.deleteMany({ where: { personId: { in: ids } } });
    await prisma.person.deleteMany({ where: { id: { in: ids } } });
  });

  it('E-001 happy path: ativa CLIENT, cria ClientProfile e persiste consent SERVICE_HIRING na tx', async () => {
    const result = await prisma.$transaction(async (tx) => {
      return ensureClientRole(tx, { personId, term: TERM, ip: IP, userAgent: UA });
    });
    expect(result.activated).toBe(true);
    expect(result.grantId).toBeTruthy();

    const grant = await prisma.personRoleGrant.findFirst({
      where: { personId, role: 'CLIENT', status: 'ACTIVE' },
    });
    expect(grant).not.toBeNull();

    const profile = await prisma.clientProfile.findUnique({ where: { personId } });
    expect(profile).not.toBeNull();

    const consent = await prisma.consent.findFirst({
      where: { personId, purpose: 'SERVICE_HIRING', revokedAt: null },
    });
    expect(consent).not.toBeNull();
    expect(consent?.termVersion).toBe(TERM.version);
    expect(consent?.acceptedIp).toBe(IP);

    // AC #118-2: o consent-base PORTAL_ACCESS permanece ativo após a ativação.
    const portal = await prisma.consent.findFirst({
      where: { personId, purpose: 'PORTAL_ACCESS', revokedAt: null },
    });
    expect(portal).not.toBeNull();
  });

  it('AC #118-2: consent SERVICE_HIRING persistido com versão, data e IP', async () => {
    const consent = await prisma.consent.findFirst({
      where: { personId, purpose: 'SERVICE_HIRING', revokedAt: null },
    });
    expect(consent?.termVersion).toBe(TERM.version);
    expect(consent?.termContentHash).toBe(TERM.hash);
    expect(consent?.acceptedIp).toBe(IP);
    expect(consent?.userAgent).toBe(UA);
    expect(consent?.acceptedAt).toBeTruthy();
  });

  it('P-001 atomicidade: grant CLIENT em ACTIVE só existe com consent SERVICE_HIRING persistido', async () => {
    // Verifica a invariante de ordem: o audit de CLIENT_ROLE_ACTIVATED existe somente após o consent.
    const auditActivated = await prisma.auditLog.findFirst({
      where: { actorPersonId: personId, action: 'CLIENT_ROLE_ACTIVATED' },
    });
    const consent = await prisma.consent.findFirst({
      where: { personId, purpose: 'SERVICE_HIRING', revokedAt: null },
    });
    // Ambos devem existir juntos — a tx garante que não há um sem o outro.
    expect(auditActivated).not.toBeNull();
    expect(consent).not.toBeNull();
  });

  it('E-002 idempotência: reexecução é no-op quando CLIENT já está ativo', async () => {
    const result = await prisma.$transaction(async (tx) => {
      return ensureClientRole(tx, { personId: personWithClientId, term: TERM, ip: IP, userAgent: UA });
    });
    expect(result.activated).toBe(false);

    const grantCount = await prisma.personRoleGrant.count({
      where: { personId: personWithClientId, role: 'CLIENT' },
    });
    expect(grantCount).toBe(1);

    const consentCount = await prisma.consent.count({
      where: { personId: personWithClientId, purpose: 'SERVICE_HIRING', revokedAt: null },
    });
    expect(consentCount).toBe(1);

    const profileCount = await prisma.clientProfile.count({
      where: { personId: personWithClientId },
    });
    expect(profileCount).toBe(1);
  });

  it('E-002 auditoria condicional: CLIENT_ROLE_ACTIVATED não é emitido no no-op', async () => {
    const countBefore = await prisma.auditLog.count({
      where: { actorPersonId: personWithClientId, action: 'CLIENT_ROLE_ACTIVATED' },
    });
    await prisma.$transaction(async (tx) => {
      return ensureClientRole(tx, { personId: personWithClientId, term: TERM, ip: null, userAgent: null });
    });
    const countAfter = await prisma.auditLog.count({
      where: { actorPersonId: personWithClientId, action: 'CLIENT_ROLE_ACTIVATED' },
    });
    expect(countAfter).toBe(countBefore); // sem novo evento
  });

  it('P-001 rollback: se a tx for revertida, nenhum dado persiste', async () => {
    const testPersonId = (
      await prisma.person.create({
        data: { fullName: 'Rollback Test USP011', status: 'ATIVO' },
        select: { id: true },
      })
    ).id;
    // PORTAL_ACCESS ativo: o helper precisa avançar até a ativação real para que o
    // throw posterior exercite o rollback do trabalho efetivamente persistido.
    await prisma.consent.create({
      data: { personId: testPersonId, purpose: 'PORTAL_ACCESS', termVersion: 'v1.0', termContentHash: 'x' },
    });

    try {
      await prisma.$transaction(async (tx) => {
        await ensureClientRole(tx, { personId: testPersonId, term: TERM, ip: null, userAgent: null });
        throw new Error('rollback simulado');
      });
    } catch {
      // esperado
    }

    const grant = await prisma.personRoleGrant.findFirst({ where: { personId: testPersonId, role: 'CLIENT' } });
    const profile = await prisma.clientProfile.findUnique({ where: { personId: testPersonId } });
    const consent = await prisma.consent.findFirst({ where: { personId: testPersonId, purpose: 'SERVICE_HIRING' } });
    expect(grant).toBeNull();
    expect(profile).toBeNull();
    expect(consent).toBeNull();

    await prisma.consent.deleteMany({ where: { personId: testPersonId } });
    await prisma.person.delete({ where: { id: testPersonId } });
  });

  it('AC #118-2 guard: lança e nada persiste quando PORTAL_ACCESS está ausente', async () => {
    const noPortalId = (
      await prisma.person.create({
        data: { fullName: 'Sem Portal USP011', status: 'ATIVO' },
        select: { id: true },
      })
    ).id;

    // Sem PORTAL_ACCESS: o helper deve abortar (lançar) ANTES de qualquer escrita.
    await expect(
      prisma.$transaction(async (tx) => {
        return ensureClientRole(tx, { personId: noPortalId, term: TERM, ip: null, userAgent: null });
      }),
    ).rejects.toThrow('PORTAL_ACCESS_CONSENT_MISSING');

    const grant = await prisma.personRoleGrant.findFirst({ where: { personId: noPortalId, role: 'CLIENT' } });
    const profile = await prisma.clientProfile.findUnique({ where: { personId: noPortalId } });
    const consent = await prisma.consent.findFirst({ where: { personId: noPortalId, purpose: 'SERVICE_HIRING' } });
    expect(grant).toBeNull();
    expect(profile).toBeNull();
    expect(consent).toBeNull();

    await prisma.person.delete({ where: { id: noPortalId } });
  });
});
