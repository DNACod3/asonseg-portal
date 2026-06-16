import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de removerResponsavel (USP-014 / T6). Requer Postgres
 * local (`supabase start`) e DATABASE_URL no env. Materializa os facts da USP-014:
 *  AC-014-1 (happy 2→1, revokedAt/revokedBy + audit + outbox + motivo) ·
 *  AC-014-2 (bloqueio do último ativo) · AC-014-3 (histórico preservado, sem delete) ·
 *  permissão (FORBIDDEN) · idempotência (NOT_FOUND) · auto-remoção com outro ativo.
 *
 * Cada teste recria o cenário (beforeEach) para isolar o estado dos vínculos.
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
const { removerResponsavel } = await import('../actions/remove-responsible');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const COMPANY_CNPJ = 'usp014t6-40688310000142';
const ACTOR_SUPABASE = '00000000-0000-0000-0000-0000000140a1';
const REMOVED_EMAIL = 'removido-usp014@example.com';
const OUTSIDER_EMAIL = 'outsider-usp014@example.com';

function asPerson(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: ACTOR_SUPABASE,
    fullName: 'Ator Remove Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['COMPANY_RESPONSIBLE'],
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('removerResponsavel — integração', () => {
  let actorId = '';
  let coRespId = '';
  let outsiderId = '';
  let companyId = '';

  async function cleanup() {
    const stale = await prisma.company.findUnique({ where: { cnpj: COMPANY_CNPJ }, select: { id: true } });
    if (stale) {
      await prisma.outbox.deleteMany({});
      await prisma.personCompanyGrant.deleteMany({ where: { companyId: stale.id } });
      await prisma.company.delete({ where: { id: stale.id } });
    }
    const people = await prisma.person.findMany({
      where: {
        OR: [
          { emailLogin: { in: [REMOVED_EMAIL, OUTSIDER_EMAIL] } },
          { supabaseUserId: ACTOR_SUPABASE },
        ],
      },
      select: { id: true },
    });
    if (people.length) {
      const ids = people.map((p) => p.id);
      // audit_log é append-only (DELETE bloqueado no banco) — os registros das
      // runs anteriores ficam; não há FK que impeça remover as Pessoas.
      await prisma.personCompanyGrant.deleteMany({ where: { personId: { in: ids } } });
      await prisma.person.deleteMany({ where: { id: { in: ids } } });
    }
  }

  beforeEach(async () => {
    await cleanup();

    const actor = await prisma.person.create({
      data: { fullName: 'Ator Remove Int', status: 'ATIVO', supabaseUserId: ACTOR_SUPABASE },
      select: { id: true },
    });
    actorId = actor.id;

    const coResp = await prisma.person.create({
      data: { fullName: 'Co-resp Remove Int', status: 'ATIVO', emailLogin: REMOVED_EMAIL },
      select: { id: true },
    });
    coRespId = coResp.id;

    const outsider = await prisma.person.create({
      data: { fullName: 'Outsider Remove Int', status: 'ATIVO', emailLogin: OUTSIDER_EMAIL },
      select: { id: true },
    });
    outsiderId = outsider.id;

    const company = await prisma.company.create({
      data: { cnpj: COMPANY_CNPJ, razaoSocial: 'Empresa T6 Ltda', nomeFantasia: 'T6', setor: 'Teste', isVerified: false, createdBy: actorId },
      select: { id: true },
    });
    companyId = company.id;

    // Dois responsáveis ATIVOS: ator + co-responsável.
    await prisma.personCompanyGrant.createMany({
      data: [
        { personId: actorId, companyId, grantType: 'RESPONSIBLE', grantedBy: actorId, status: 'ACTIVE' },
        { personId: coRespId, companyId, grantType: 'RESPONSIBLE', grantedBy: actorId, status: 'ACTIVE' },
      ],
    });

    mockPerson = asPerson(actorId);
  });

  afterAll(async () => {
    await cleanup();
    const ids = [actorId, coRespId, outsiderId].filter(Boolean);
    if (ids.length) {
      await prisma.personCompanyGrant.deleteMany({ where: { personId: { in: ids } } });
      await prisma.person.deleteMany({ where: { id: { in: ids } } });
    }
  });

  function grantOf(personId: string) {
    return prisma.personCompanyGrant.findFirstOrThrow({
      where: { personId, companyId, revokedAt: null },
      select: { id: true },
    });
  }

  it('Zod: rejeita grantId que não é UUID', async () => {
    const res = await removerResponsavel({ grantId: 'nao-uuid' });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('idempotência: grant inexistente → NOT_FOUND', async () => {
    const res = await removerResponsavel({ grantId: '00000000-0000-4000-8000-000000000999' });
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('@permissao — nega quando o ator não é responsável ativo da Empresa', async () => {
    mockPerson = asPerson(outsiderId);
    const target = await grantOf(coRespId);
    const res = await removerResponsavel({ grantId: target.id });
    expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('@ac-014-1 — happy (2→1): revoga grant, audita e enfileira e-mail (sem delete)', async () => {
    const target = await grantOf(coRespId);
    const res = await removerResponsavel({ grantId: target.id, motivo: 'Saiu da empresa' });
    expect(res).toMatchObject({ ok: true, data: { selfRemoved: false } });

    // Append-only: a linha continua existindo, agora revogada com motivo.
    const grant = await prisma.personCompanyGrant.findUnique({
      where: { id: target.id },
      select: { revokedAt: true, revokedBy: true, revokeReason: true },
    });
    expect(grant?.revokedAt).not.toBeNull();
    expect(grant?.revokedBy).toBe(actorId);
    expect(grant?.revokeReason).toBe('Saiu da empresa');

    // Auditoria do evento.
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'COMPANY_RESPONSIBLE_REMOVED', actorPersonId: actorId, entityId: target.id },
      select: { id: true },
    });
    expect(audit).not.toBeNull();

    // Outbox: aviso "responsible-removed" para a Pessoa removida.
    const msg = await prisma.outbox.findFirst({
      where: { topic: 'email' },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    });
    const payload = msg?.payload as { to: string; template: string };
    expect(payload.template).toBe('responsible-removed');
    expect(payload.to).toBe(REMOVED_EMAIL);
  });

  it('@ac-014-2 — bloqueia a remoção do último responsável ativo', async () => {
    // Remove o co-responsável → ator vira o único ativo.
    const co = await grantOf(coRespId);
    await prisma.personCompanyGrant.update({ where: { id: co.id }, data: { revokedAt: new Date() } });

    const self = await grantOf(actorId);
    const res = await removerResponsavel({ grantId: self.id });
    expect(res).toMatchObject({ ok: false, error: { code: 'PRECONDITION_FAILED' } });

    // Permanece ativo.
    const still = await prisma.personCompanyGrant.findUnique({ where: { id: self.id }, select: { revokedAt: true } });
    expect(still?.revokedAt).toBeNull();
  });

  it('@ac-014-1 — auto-remoção permitida quando há outro responsável ativo', async () => {
    const self = await grantOf(actorId);
    const res = await removerResponsavel({ grantId: self.id });
    expect(res).toMatchObject({ ok: true, data: { selfRemoved: true } });
  });

  it('@ac-014-3 — histórico preservado: grant removido segue consultável', async () => {
    const target = await grantOf(coRespId);
    await removerResponsavel({ grantId: target.id });

    const count = await prisma.personCompanyGrant.count({ where: { id: target.id } });
    expect(count).toBe(1); // nunca deletado
    const removed = await prisma.personCompanyGrant.findUnique({
      where: { id: target.id },
      select: { revokedAt: true },
    });
    expect(removed?.revokedAt).not.toBeNull();
  });
});
