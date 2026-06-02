import { describe, it, expect, beforeEach, afterAll } from 'vitest';

/**
 * Integração do `PrismaAuthAttemptsRepo` (USP-004 — T-04).
 * Requer Postgres local (`supabase start`) + DATABASE_URL. Exercita a tabela
 * técnica `auth_attempts`: gravação, janela, filtro por chave `(email, ip)` e reset.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { PrismaAuthAttemptsRepo } = await import('../adapters/authAttemptsRepo');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const EMAIL = 'repo-int@example.com';
const IP_A = '198.51.100.1';
const IP_B = '198.51.100.2';

skipIfNoDb('PrismaAuthAttemptsRepo — integração', () => {
  const repo = new PrismaAuthAttemptsRepo();

  async function clean() {
    await prisma.authAttempt.deleteMany({ where: { email: EMAIL } });
  }

  beforeEach(clean);
  afterAll(clean);

  it('record + recent: 6 falhas na janela retornam as 6', async () => {
    for (let i = 0; i < 6; i++) {
      await repo.record({ email: EMAIL, ip: IP_A, outcome: 'FAILURE' });
    }
    const recent = await repo.recent({ email: EMAIL, ip: IP_A, windowMs: 15 * 60_000 });
    expect(recent).toHaveLength(6);
    expect(recent.every((r) => r.outcome === 'FAILURE')).toBe(true);
  });

  it('recent filtra pela chave (email, ip): IPs distintos não se misturam', async () => {
    await repo.record({ email: EMAIL, ip: IP_A, outcome: 'FAILURE' });
    await repo.record({ email: EMAIL, ip: IP_A, outcome: 'FAILURE' });
    await repo.record({ email: EMAIL, ip: IP_B, outcome: 'FAILURE' });

    const a = await repo.recent({ email: EMAIL, ip: IP_A, windowMs: 15 * 60_000 });
    const b = await repo.recent({ email: EMAIL, ip: IP_B, windowMs: 15 * 60_000 });
    expect(a).toHaveLength(2);
    expect(b).toHaveLength(1);
  });

  it('recent com janela curta descarta tentativas antigas', async () => {
    // Tentativa antiga (20 min atrás) inserida diretamente.
    await prisma.authAttempt.create({
      data: {
        email: EMAIL,
        ip: IP_A,
        outcome: 'FAILURE',
        attemptedAt: new Date(Date.now() - 20 * 60_000),
      },
    });
    await repo.record({ email: EMAIL, ip: IP_A, outcome: 'FAILURE' }); // recente

    const recent = await repo.recent({ email: EMAIL, ip: IP_A, windowMs: 15 * 60_000 });
    expect(recent).toHaveLength(1);
  });

  it('record normaliza o e-mail (case/space) para a chave', async () => {
    await repo.record({ email: '  REPO-INT@example.COM ', ip: IP_A, outcome: 'FAILURE' });
    const recent = await repo.recent({ email: EMAIL, ip: IP_A, windowMs: 15 * 60_000 });
    expect(recent).toHaveLength(1);
  });

  it('reset apaga as tentativas da chave', async () => {
    await repo.record({ email: EMAIL, ip: IP_A, outcome: 'FAILURE' });
    await repo.record({ email: EMAIL, ip: IP_A, outcome: 'FAILURE' });
    await repo.reset({ email: EMAIL, ip: IP_A });
    const recent = await repo.recent({ email: EMAIL, ip: IP_A, windowMs: 15 * 60_000 });
    expect(recent).toHaveLength(0);
  });
});
