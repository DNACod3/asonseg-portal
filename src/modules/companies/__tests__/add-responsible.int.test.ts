import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de adicionarResponsavel (USP-013 / T3). Requer Postgres
 * local (`supabase start`) e DATABASE_URL no env. Cobre os casos obrigatórios de
 * Server Action (happy · Zod · permissão · rate limit · concorrência) e os facts:
 *  E-001/P-002 (PENDING) · E-002 (não cadastrada) · E-003 (outbox) ·
 *  P-001 (busca sem PII) · P-004 (duplicidade 409 sequencial + corrida P2002) ·
 *  P-005 (permissão) · L-002 (rate limit anti-enumeração).
 */

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.2', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;
vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
  requireActivePerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { adicionarResponsavel } = await import('../actions/add-responsible');
const { rateLimiter, RATE_LIMITS } = await import('@/shared/lib/rateLimit');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const TARGET_CPF = '39053344705';
const TARGET_EMAIL = 'alvo-usp013@example.com';
// Segunda Pessoa-alvo, dedicada ao teste de corrida (sem vínculo prévio).
const TARGET2_EMAIL = 'alvo2-usp013@example.com';
const COMPANY_CNPJ = 'usp013t3-11013013013010';

skipIfNoDb('adicionarResponsavel — integração', () => {
  let actorId = '';
  let targetId = '';
  let target2Id = '';
  let companyId = '';

  beforeAll(async () => {
    // Cleanup idempotente de runs anteriores.
    const staleCompany = await prisma.company.findUnique({ where: { cnpj: COMPANY_CNPJ }, select: { id: true } });
    if (staleCompany) {
      await prisma.outbox.deleteMany({});
      await prisma.personCompanyGrant.deleteMany({ where: { companyId: staleCompany.id } });
      await prisma.company.delete({ where: { id: staleCompany.id } });
    }
    const staleTargets = await prisma.person.findMany({
      where: { OR: [{ cpf: TARGET_CPF }, { emailLogin: { in: [TARGET_EMAIL, TARGET2_EMAIL] } }] },
      select: { id: true },
    });
    if (staleTargets.length > 0) {
      const ids = staleTargets.map((t) => t.id);
      await prisma.personCompanyGrant.deleteMany({ where: { personId: { in: ids } } });
      await prisma.person.deleteMany({ where: { id: { in: ids } } });
    }

    const actor = await prisma.person.create({
      data: { fullName: 'Ator Resp Int', status: 'ATIVO', supabaseUserId: '00000000-0000-0000-0000-0000000130a1' },
      select: { id: true },
    });
    actorId = actor.id;

    const target = await prisma.person.create({
      data: { fullName: 'Alvo Resp Int', status: 'ATIVO', cpf: TARGET_CPF, emailLogin: TARGET_EMAIL },
      select: { id: true },
    });
    targetId = target.id;

    const target2 = await prisma.person.create({
      data: { fullName: 'Alvo2 Resp Int', status: 'ATIVO', emailLogin: TARGET2_EMAIL },
      select: { id: true },
    });
    target2Id = target2.id;

    const company = await prisma.company.create({
      data: { cnpj: COMPANY_CNPJ, razaoSocial: 'Empresa T3 Ltda', nomeFantasia: 'T3', setor: 'Teste', isVerified: false, createdBy: actorId },
      select: { id: true },
    });
    companyId = company.id;

    // Ator é responsável ATIVO da Empresa.
    await prisma.personCompanyGrant.create({
      data: { personId: actorId, companyId, grantType: 'RESPONSIBLE', grantedBy: actorId, status: 'ACTIVE' },
    });

    mockPerson = {
      id: actorId,
      supabaseUserId: '00000000-0000-0000-0000-0000000130a1',
      fullName: 'Ator Resp Int',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles: ['COMPANY_RESPONSIBLE'],
      phone: null,
      fullAddress: null,
    };
  });

  afterAll(async () => {
    if (companyId) {
      await prisma.outbox.deleteMany({});
      await prisma.personCompanyGrant.deleteMany({ where: { companyId } });
      await prisma.company.deleteMany({ where: { id: companyId } });
    }
    const pids = [actorId, targetId, target2Id].filter(Boolean);
    if (pids.length > 0) {
      await prisma.personCompanyGrant.deleteMany({ where: { personId: { in: pids } } });
      await prisma.person.deleteMany({ where: { id: { in: pids } } });
    }
  });

  it('Zod: rejeita identificador que não é CPF nem e-mail válido', async () => {
    const res = await adicionarResponsavel({ empresaId: companyId, cpfOuEmail: '???' });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('@ac-p-005 — nega quando o ator não é responsável ativo da Empresa (U13-MN-03: zero grant criado)', async () => {
    const fakeCompanyId = '00000000-0000-0000-0000-0000000000ff';
    const res = await adicionarResponsavel({
      empresaId: fakeCompanyId,
      cpfOuEmail: TARGET_CPF,
    });
    expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    const grant = await prisma.personCompanyGrant.findFirst({
      where: { personId: targetId, companyId: fakeCompanyId },
      select: { id: true },
    });
    expect(grant).toBeNull();
  });

  it('@ac-e-002 — Pessoa não cadastrada → NOT_FOUND orientando auto-cadastro', async () => {
    const res = await adicionarResponsavel({ empresaId: companyId, cpfOuEmail: 'naoexiste-usp013@example.com' });
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('@ac-e-001 @ac-p-002 @ac-p-001 — happy: cria vínculo PENDING, audita e não retorna PII', async () => {
    const res = await adicionarResponsavel({ empresaId: companyId, cpfOuEmail: TARGET_CPF });
    expect(res).toMatchObject({ ok: true, data: { status: 'PENDING' } });
    if (!res.ok) return;

    // P-001: o retorno não carrega nome/PII da Pessoa-alvo.
    expect(JSON.stringify(res.data)).not.toContain('Alvo Resp Int');

    const grant = await prisma.personCompanyGrant.findFirst({
      where: { personId: targetId, companyId, revokedAt: null },
      select: { status: true, grantType: true, pendingAt: true, grantedBy: true },
    });
    expect(grant).toMatchObject({ status: 'PENDING', grantType: 'RESPONSIBLE', grantedBy: actorId });
    expect(grant?.pendingAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'COMPANY_RESPONSIBLE_ADDED', actorPersonId: actorId, entityType: 'person_company_grant' },
      orderBy: { occurredAt: 'desc' },
      select: { id: true },
    });
    expect(audit).not.toBeNull();
  });

  it('@ac-e-003 — enfileira o e-mail de aceite no outbox na mesma transação', async () => {
    const msg = await prisma.outbox.findFirst({
      where: { topic: 'email' },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    });
    expect(msg).not.toBeNull();
    const payload = msg?.payload as { to: string; template: string; data: { acceptUrl: string } };
    expect(payload.template).toBe('responsible-link-pending');
    expect(payload.to).toBe(TARGET_EMAIL);
    expect(payload.data.acceptUrl).toContain(`empresaId=${companyId}`);
  });

  it('@ac-p-004 — duplicidade de vínculo não-removido → CONFLICT', async () => {
    const res = await adicionarResponsavel({ empresaId: companyId, cpfOuEmail: TARGET_CPF });
    expect(res).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
  });

  it('@ac-p-004 — corrida: duas adições concorrentes da mesma Pessoa → 1 cria, 1 CONFLICT (UNIQUE parcial / P2002)', async () => {
    // Ambas as chamadas passam o pré-check (passo 6b) antes de qualquer commit, então
    // o índice UNIQUE parcial deixa só uma criar e a outra cai no catch P2002 → CONFLICT.
    // Exercita o ramo de corrida que o teste sequencial acima não alcança.
    const results = await Promise.all([
      adicionarResponsavel({ empresaId: companyId, cpfOuEmail: TARGET2_EMAIL }),
      adicionarResponsavel({ empresaId: companyId, cpfOuEmail: TARGET2_EMAIL }),
    ]);
    expect(results.filter((r) => r.ok).length).toBe(1);
    expect(results.filter((r) => !r.ok && r.error.code === 'CONFLICT').length).toBe(1);

    // Invariante do índice parcial: exatamente um vínculo não-removido sobrevive.
    const grants = await prisma.personCompanyGrant.count({
      where: { personId: target2Id, companyId, revokedAt: null },
    });
    expect(grants).toBe(1);
  });

  it('@ac-l-002 — estoura o rate limit anti-enumeração → PRECONDITION_FAILED', async () => {
    // Janela limpa para contagem determinística (o limiter é singleton de processo).
    rateLimiter.reset();
    const { limit } = RATE_LIMITS.responsibleLookup;
    // Consome toda a janela com buscas inexistentes (NOT_FOUND — sem efeito colateral).
    for (let i = 0; i < limit; i++) {
      const res = await adicionarResponsavel({ empresaId: companyId, cpfOuEmail: `rl-${i}-usp013@example.com` });
      expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    }
    const blocked = await adicionarResponsavel({ empresaId: companyId, cpfOuEmail: 'rl-final-usp013@example.com' });
    expect(blocked).toMatchObject({ ok: false, error: { code: 'PRECONDITION_FAILED' } });
  });
});
