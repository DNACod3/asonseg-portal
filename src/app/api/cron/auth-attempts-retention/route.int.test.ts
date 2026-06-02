import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

/**
 * Integração do job de retenção de `auth_attempts` (USP-004 — T-11).
 * Requer Postgres local + DATABASE_URL. Valida que apenas tentativas mais
 * antigas que a retenção configurada são apagadas, e a proteção por segredo.
 */

vi.mock('@/shared/env', async (orig) => {
  const actual = (await orig()) as { env: Record<string, unknown> };
  return { env: { ...actual.env, CRON_SECRET: 'segredo-cron-teste', AUTH_ATTEMPTS_RETENTION_DAYS: 1 } };
});

const { prisma } = await import('@/shared/lib/prisma');
const { GET } = await import('./route');
const { NextRequest } = await import('next/server');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);
const EMAIL = 'cron-int@example.com';

function makeRequest(headers: Record<string, string> = {}): import('next/server').NextRequest {
  return new NextRequest('http://localhost/api/cron/auth-attempts-retention', { headers });
}

skipIfNoDb('cron auth-attempts-retention — integração', () => {
  async function clean() {
    await prisma.authAttempt.deleteMany({ where: { email: EMAIL } });
  }
  beforeEach(clean);
  afterAll(clean);

  it('sem segredo correto → 401, nada é apagado', async () => {
    await prisma.authAttempt.create({
      data: { email: EMAIL, ip: '203.0.113.9', outcome: 'FAILURE', attemptedAt: new Date(Date.now() - 5 * 86_400_000) },
    });
    const res = await GET(makeRequest({ 'x-cron-secret': 'errado' }));
    expect(res.status).toBe(401);
    const remaining = await prisma.authAttempt.count({ where: { email: EMAIL } });
    expect(remaining).toBe(1);
  });

  it('com segredo correto → apaga só as antigas (>1 dia) e mantém recentes', async () => {
    await prisma.authAttempt.createMany({
      data: [
        { email: EMAIL, ip: '203.0.113.9', outcome: 'FAILURE', attemptedAt: new Date(Date.now() - 5 * 86_400_000) },
        { email: EMAIL, ip: '203.0.113.9', outcome: 'FAILURE', attemptedAt: new Date(Date.now() - 3 * 86_400_000) },
        { email: EMAIL, ip: '203.0.113.9', outcome: 'FAILURE', attemptedAt: new Date() },
      ],
    });

    const res = await GET(makeRequest({ 'x-cron-secret': 'segredo-cron-teste' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; deleted: number };
    expect(body.ok).toBe(true);
    expect(body.deleted).toBe(2);

    const remaining = await prisma.authAttempt.count({ where: { email: EMAIL } });
    expect(remaining).toBe(1);
  });

  it('aceita o segredo via Authorization: Bearer', async () => {
    const res = await GET(makeRequest({ authorization: 'Bearer segredo-cron-teste' }));
    expect(res.status).toBe(200);
  });
});
