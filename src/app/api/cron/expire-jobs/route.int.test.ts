import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

/**
 * Integração da rota de cron `expire-jobs` (USP-024 / T3). Requer Postgres local
 * (`supabase start`). Espelha `auth-attempts-retention/route.int.test.ts` + cobre
 * o caso `CRON_SECRET` ausente (503, fail-closed) que o espelho não exercitava.
 *
 * Cobre: sem CRON_SECRET no ambiente → 503; segredo ausente/incorreto → 401 e zero
 * transições (U24-MN-06); sucesso → 200 com resumo `{expired, scanned}`; aceita
 * `Authorization: Bearer`.
 */

const mockEnv: { CRON_SECRET: string | undefined } = { CRON_SECRET: 'segredo-cron-expire-teste' };

vi.mock('@/shared/env', async (orig) => {
  const actual = (await orig()) as { env: Record<string, unknown> };
  return { env: new Proxy(actual.env, { get: (target, prop) => (prop === 'CRON_SECRET' ? mockEnv.CRON_SECRET : target[prop as keyof typeof target]) }) };
});

const { prisma } = await import('@/shared/lib/prisma');
const { GET } = await import('./route');
const { NextRequest } = await import('next/server');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);
const CNPJ = '11444777000310';

function makeRequest(headers: Record<string, string> = {}): import('next/server').NextRequest {
  return new NextRequest('http://localhost/api/cron/expire-jobs', { headers });
}

function dateOffset(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - 30 + days); // bem no passado/futuro — não é teste de borda de fuso
  return d;
}

skipIfNoDb('cron expire-jobs — integração', () => {
  let authorId = '';
  let companyId = '';

  async function cleanup() {
    await prisma.job.deleteMany({ where: { company: { cnpj: CNPJ } } });
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
  }

  beforeAll(async () => {
    await cleanup();
    const author = await prisma.person.create({ data: { fullName: 'Autor Cron Expire Int', status: 'ATIVO' }, select: { id: true } });
    authorId = author.id;
  });

  beforeEach(async () => {
    mockEnv.CRON_SECRET = 'segredo-cron-expire-teste';
    await cleanup();
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Cron Expire Int Ltda',
        nomeFantasia: 'Cron Expire Int',
        setor: 'Comércio',
        createdBy: authorId,
        isVerified: true,
      },
      select: { id: true },
    });
    companyId = company.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: authorId } });
  });

  it('U24-MN-06: sem segredo correto → 401, zero transições', async () => {
    const job = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga Cron Expire Int', status: 'ACTIVE', validUntil: dateOffset(-1) },
      select: { id: true },
    });

    const res = await GET(makeRequest({ 'x-cron-secret': 'errado' }));
    expect(res.status).toBe(401);

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true } });
    expect(row?.status).toBe('ACTIVE');
  });

  it('com segredo correto → 200 com { expired, scanned }', async () => {
    await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga Cron Expire Int', status: 'ACTIVE', validUntil: dateOffset(-1) },
    });

    const res = await GET(makeRequest({ 'x-cron-secret': 'segredo-cron-expire-teste' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; expired: number; scanned: number };
    expect(body).toMatchObject({ ok: true, expired: 1, scanned: 1 });
  });

  it('aceita o segredo via Authorization: Bearer', async () => {
    const res = await GET(makeRequest({ authorization: 'Bearer segredo-cron-expire-teste' }));
    expect(res.status).toBe(200);
  });

  it('CRON_SECRET não configurado no ambiente → 503 (fail-closed), zero transições', async () => {
    const job = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga Cron Expire Int', status: 'ACTIVE', validUntil: dateOffset(-1) },
      select: { id: true },
    });
    mockEnv.CRON_SECRET = undefined;

    const res = await GET(makeRequest({ 'x-cron-secret': 'qualquer-coisa' }));
    expect(res.status).toBe(503);

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true } });
    expect(row?.status).toBe('ACTIVE');
  });
});
