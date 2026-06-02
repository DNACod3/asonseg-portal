import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';

/**
 * Teste anti-timing (USP-004 — T-10, P-002 / L-001 / D-002).
 *
 * Garante que o caminho de "e-mail inexistente" e o de "senha errada para
 * e-mail existente" levam tempos comparáveis — sem isso, a diferença permite
 * enumerar e-mails cadastrados. Mede N execuções de cada caminho e compara as
 * **medianas** (resistentes a outliers de GC/agendamento), tolerando até
 * `AUTH_TIMING_TOLERANCE_MS` (default 200ms — folgado para CI compartilhado).
 *
 * Pode ser sensível em runner muito carregado; se necessário, mover para job
 * dedicado (registrar SPEC_DEVIATION). Requer `supabase start` + DATABASE_URL.
 */

const TEST_IP = '198.51.100.88';
const cookieJar = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => Array.from(cookieJar, ([name, value]) => ({ name, value })),
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      if (value === '') cookieJar.delete(name);
      else cookieJar.set(name, value);
    },
    delete: (name: string) => cookieJar.delete(name),
  }),
  headers: async () => new Headers({ 'x-real-ip': TEST_IP, 'user-agent': 'vitest-timing' }),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { createSupabaseAdminClient } = await import('@/shared/lib/supabase/server');
const { loginAction } = await import('../actions/login');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const EMAIL = 'timing-int@example.com';
const PASSWORD = 'SenhaForte#Timing1';
const UNKNOWN_EMAIL = 'timing-ghost@example.com';
const TOLERANCE_MS = Number(process.env.AUTH_TIMING_TOLERANCE_MS ?? 200);
const SAMPLES = 9;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

async function measure(email: string, senha: string): Promise<number> {
  const t0 = performance.now();
  await loginAction({ email, senha });
  return performance.now() - t0;
}

skipIfNoDb('loginAction — anti-timing', () => {
  const admin = createSupabaseAdminClient();

  beforeAll(async () => {
    await fullClean();
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`createUser falhou: ${error?.message}`);
    await prisma.person.create({
      data: {
        supabaseUserId: data.user.id,
        fullName: 'Timing Integração',
        emailLogin: EMAIL,
        status: 'ATIVO',
        credential: { create: { primeiroAcesso: false } },
      },
    });
  });

  // Limpa tentativas antes de cada medição para nunca cair em lockout (≥5).
  beforeEach(async () => {
    await prisma.authAttempt.deleteMany({ where: { email: { in: [EMAIL, UNKNOWN_EMAIL] } } });
  });

  afterAll(fullClean);

  async function fullClean() {
    await prisma.authAttempt.deleteMany({ where: { email: { in: [EMAIL, UNKNOWN_EMAIL] } } });
    const existing = await prisma.person.findUnique({ where: { emailLogin: EMAIL }, select: { id: true, supabaseUserId: true } });
    if (existing) {
      await prisma.credential.deleteMany({ where: { personId: existing.id } });
      await prisma.person.delete({ where: { id: existing.id } });
      if (existing.supabaseUserId) await admin.auth.admin.deleteUser(existing.supabaseUserId).catch(() => {});
    }
  }

  it(`mediana(e-mail desconhecido) ≈ mediana(senha errada) (Δ < ${TOLERANCE_MS}ms)`, async () => {
    const unknownTimes: number[] = [];
    const wrongPwdTimes: number[] = [];

    // Warm-up (descartado): aquece bcrypt dummy, conexões e JIT.
    await measure(UNKNOWN_EMAIL, 'aquecer-123');
    await measure(EMAIL, 'aquecer-errada-123');
    await prisma.authAttempt.deleteMany({ where: { email: { in: [EMAIL, UNKNOWN_EMAIL] } } });

    for (let i = 0; i < SAMPLES; i++) {
      // Intercala e reseta para nunca atingir o lockout dentro do laço.
      unknownTimes.push(await measure(UNKNOWN_EMAIL, `errada-${i}`));
      wrongPwdTimes.push(await measure(EMAIL, `errada-${i}`));
      await prisma.authAttempt.deleteMany({ where: { email: { in: [EMAIL, UNKNOWN_EMAIL] } } });
    }

    const delta = Math.abs(median(unknownTimes) - median(wrongPwdTimes));
    expect(delta).toBeLessThan(TOLERANCE_MS);
  });
});
