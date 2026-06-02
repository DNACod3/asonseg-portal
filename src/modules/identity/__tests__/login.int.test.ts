import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';

/**
 * Integração ponta-a-ponta da `loginAction` (USP-004 — T-06) contra a stack
 * Supabase local. Cobre AC-004-1/2/3/5/6: login válido, mensagem genérica,
 * lockout, 1º acesso e Pessoa inativa. Requer `supabase start` + DATABASE_URL.
 *
 * Mock: apenas `next/headers` (cookies em memória + headers de IP/UA), para que
 * o client SSR do Supabase funcione fora de um request HTTP. Auth, Prisma e
 * auditoria são reais.
 */

const TEST_IP = '198.51.100.77';
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
  headers: async () => new Headers({ 'x-real-ip': TEST_IP, 'user-agent': 'vitest-int' }),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { createSupabaseAdminClient } = await import('@/shared/lib/supabase/server');
const { loginAction } = await import('../actions/login');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const EMAIL = 'login-int@example.com';
const PASSWORD = 'SenhaForte#2026';
const UNKNOWN_EMAIL = 'fantasma-int@example.com';

skipIfNoDb('loginAction — integração (Supabase local)', () => {
  const admin = createSupabaseAdminClient();
  let supabaseUserId = '';
  let personId = '';

  beforeAll(async () => {
    await fullClean();
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`createUser falhou: ${error?.message}`);
    supabaseUserId = data.user.id;

    const person = await prisma.person.create({
      data: {
        supabaseUserId,
        fullName: 'Login Integração',
        emailLogin: EMAIL,
        status: 'ATIVO',
        credential: { create: { primeiroAcesso: false } },
      },
      select: { id: true },
    });
    personId = person.id;
  });

  beforeEach(async () => {
    cookieJar.clear();
    await prisma.authAttempt.deleteMany({ where: { email: { in: [EMAIL, UNKNOWN_EMAIL] } } });
  });

  afterAll(fullClean);

  async function fullClean() {
    await prisma.authAttempt.deleteMany({ where: { email: { in: [EMAIL, UNKNOWN_EMAIL] } } });
    const existing = await prisma.person.findUnique({ where: { emailLogin: EMAIL }, select: { id: true, supabaseUserId: true } });
    if (existing) {
      // audit_log é append-only (ADR-T-0004): não se apaga; não há FK p/ person.
      await prisma.credential.deleteMany({ where: { personId: existing.id } });
      await prisma.person.delete({ where: { id: existing.id } });
      if (existing.supabaseUserId) {
        await admin.auth.admin.deleteUser(existing.supabaseUserId).catch(() => {});
      }
    }
  }

  it('AC-004-1: credenciais válidas → ok + redireciona a /inicio', async () => {
    const result = await loginAction({ email: EMAIL, senha: PASSWORD });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.redirectTo).toBe('/inicio');

    // Auditou sucesso e zerou as tentativas da chave.
    const remaining = await prisma.authAttempt.count({ where: { email: EMAIL, outcome: 'FAILURE' } });
    expect(remaining).toBe(0);
  });

  it('AC-004-2: senha errada → INVALID_CREDENTIALS (mensagem genérica) + tentativa registrada', async () => {
    const result = await loginAction({ email: EMAIL, senha: 'senha-errada-123' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_CREDENTIALS');

    const attempts = await prisma.authAttempt.count({ where: { email: EMAIL, ip: TEST_IP, outcome: 'FAILURE' } });
    expect(attempts).toBe(1);
  });

  it('AC-004-2 (edge): e-mail inexistente → INVALID_CREDENTIALS (sem vazar)', async () => {
    const result = await loginAction({ email: UNKNOWN_EMAIL, senha: 'qualquer-senha' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('AC-004-3: 5 falhas em 15min → 6ª tentativa bloqueada', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await loginAction({ email: EMAIL, senha: 'senha-errada-123' });
      expect(r.ok).toBe(false);
    }
    // 6ª tentativa — mesmo com a senha CORRETA, o lockout bloqueia.
    const blocked = await loginAction({ email: EMAIL, senha: PASSWORD });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.code).toBe('INVALID_CREDENTIALS');

    const failures = await prisma.authAttempt.count({ where: { email: EMAIL, ip: TEST_IP, outcome: 'FAILURE' } });
    expect(failures).toBeGreaterThanOrEqual(6);
  });

  it('AC-004-(edge): Pessoa INATIVA não loga', async () => {
    await prisma.person.update({ where: { id: personId }, data: { status: 'INATIVO' } });
    try {
      const result = await loginAction({ email: EMAIL, senha: PASSWORD });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('INVALID_CREDENTIALS');
    } finally {
      await prisma.person.update({ where: { id: personId }, data: { status: 'ATIVO' } });
    }
  });

  it('AC-004-5: 1º acesso → redireciona a /trocar-senha', async () => {
    await prisma.credential.update({ where: { personId }, data: { primeiroAcesso: true } });
    try {
      const result = await loginAction({ email: EMAIL, senha: PASSWORD });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.redirectTo).toBe('/trocar-senha');
    } finally {
      await prisma.credential.update({ where: { personId }, data: { primeiroAcesso: false } });
    }
  });
});
