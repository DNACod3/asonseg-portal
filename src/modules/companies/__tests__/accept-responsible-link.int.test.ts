import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de aceitarVinculoResponsavel (USP-013 / T4). Requer
 * Postgres local e DATABASE_URL. Cobre os facts:
 *  P-002/E-003 (PENDING→ACTIVE) · P-003 (papel + consent atômicos) ·
 *  P-002 (idempotência: não-PENDING) · permissão (só a própria Pessoa) · Zod.
 */

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.3', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;
vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
  requireActivePerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { aceitarVinculoResponsavel } = await import('../actions/accept-responsible-link');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const COMPANY_CNPJ = 'usp013t4-22013013013020';

function asPerson(id: string, name: string): CurrentPerson {
  return { id, supabaseUserId: null as unknown as string, fullName: name, status: 'ATIVO', primeiroAcesso: false, roles: [], phone: null, fullAddress: null };
}

skipIfNoDb('aceitarVinculoResponsavel — integração', () => {
  let ownerId = '';
  let invitedId = '';
  let strangerId = '';
  let companyId = '';

  beforeAll(async () => {
    const stale = await prisma.company.findUnique({ where: { cnpj: COMPANY_CNPJ }, select: { id: true } });
    if (stale) {
      await prisma.personCompanyGrant.deleteMany({ where: { companyId: stale.id } });
      await prisma.company.delete({ where: { id: stale.id } });
    }

    const [owner, invited, stranger] = await Promise.all([
      prisma.person.create({ data: { fullName: 'Owner T4', status: 'ATIVO' }, select: { id: true } }),
      prisma.person.create({ data: { fullName: 'Convidado T4', status: 'ATIVO' }, select: { id: true } }),
      prisma.person.create({ data: { fullName: 'Estranho T4', status: 'ATIVO' }, select: { id: true } }),
    ]);
    ownerId = owner.id;
    invitedId = invited.id;
    strangerId = stranger.id;

    const company = await prisma.company.create({
      data: { cnpj: COMPANY_CNPJ, razaoSocial: 'Empresa T4 Ltda', nomeFantasia: 'T4', setor: 'Teste', isVerified: false, createdBy: ownerId },
      select: { id: true },
    });
    companyId = company.id;

    await Promise.all([
      // Responsável ativo (criador).
      prisma.personCompanyGrant.create({
        data: { personId: ownerId, companyId, grantType: 'RESPONSIBLE', grantedBy: ownerId, status: 'ACTIVE' },
      }),
      // Vínculo PENDING do convidado — o que será aceito.
      prisma.personCompanyGrant.create({
        data: { personId: invitedId, companyId, grantType: 'RESPONSIBLE', grantedBy: ownerId, status: 'PENDING', pendingAt: new Date() },
      }),
    ]);
  });

  afterAll(async () => {
    const pids = [ownerId, invitedId, strangerId].filter(Boolean);
    if (companyId) {
      await prisma.personCompanyGrant.deleteMany({ where: { companyId } });
      await prisma.company.deleteMany({ where: { id: companyId } });
    }
    if (pids.length > 0) {
      await prisma.consent.deleteMany({ where: { personId: { in: pids } } });
      await prisma.personRoleGrant.deleteMany({ where: { personId: { in: pids } } });
      await prisma.personCompanyGrant.deleteMany({ where: { personId: { in: pids } } });
      await prisma.person.deleteMany({ where: { id: { in: pids } } });
    }
  });

  it('Zod: rejeita empresaId que não é UUID', async () => {
    mockPerson = asPerson(invitedId, 'Convidado T4');
    const res = await aceitarVinculoResponsavel({ empresaId: 'nao-uuid' });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('permissão — uma Pessoa sem vínculo pendente não aceita (idempotência defensiva)', async () => {
    mockPerson = asPerson(strangerId, 'Estranho T4');
    const res = await aceitarVinculoResponsavel({ empresaId: companyId });
    expect(res).toMatchObject({ ok: false, error: { code: 'PRECONDITION_FAILED' } });
  });

  it('@ac-p-002 @ac-e-003 @ac-p-003 — happy: PENDING→ACTIVE com papel e consent atômicos', async () => {
    mockPerson = asPerson(invitedId, 'Convidado T4');
    const res = await aceitarVinculoResponsavel({ empresaId: companyId });
    expect(res).toMatchObject({ ok: true, data: { status: 'ACTIVE' } });

    const grant = await prisma.personCompanyGrant.findFirst({
      where: { personId: invitedId, companyId, revokedAt: null },
      select: { status: true, acceptedAt: true },
    });
    expect(grant?.status).toBe('ACTIVE');
    expect(grant?.acceptedAt).not.toBeNull();

    // P-003: papel COMPANY_RESPONSIBLE ativo na mesma transação.
    const role = await prisma.personRoleGrant.findFirst({
      where: { personId: invitedId, role: 'COMPANY_RESPONSIBLE', status: 'ACTIVE' },
      select: { id: true },
    });
    expect(role).not.toBeNull();

    // P-003: consent finalidade 5 capturado.
    const consent = await prisma.consent.findFirst({
      where: { personId: invitedId, purpose: 'COMPANY_REPRESENTATION', revokedAt: null },
      select: { termVersion: true },
    });
    expect(consent?.termVersion).toBe('v1.0');

    // Auditoria do aceite.
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'COMPANY_RESPONSIBLE_LINK_ACCEPTED', actorPersonId: invitedId },
      select: { id: true },
    });
    expect(audit).not.toBeNull();
  });

  it('@ac-p-002 — idempotência: aceitar vínculo não-PENDING é bloqueado', async () => {
    mockPerson = asPerson(invitedId, 'Convidado T4');
    const res = await aceitarVinculoResponsavel({ empresaId: companyId });
    expect(res).toMatchObject({ ok: false, error: { code: 'PRECONDITION_FAILED' } });
  });
});
