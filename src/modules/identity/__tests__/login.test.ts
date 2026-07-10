import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Testes unitários da `loginAction` (USP-004 — T-06) com ports mockados.
 * O provedor de auth e o repositório de tentativas são fakes registrados no
 * container; Prisma (busca de Pessoa), auditoria e anti-timing são mockados.
 */

// ── Estado mutável compartilhado com as factories de mock (hoisted) ──────────
const envState = vi.hoisted(() => ({ loginEnabled: true }));
const auditState = vi.hoisted(() => ({ events: [] as string[] }));
const prismaState = vi.hoisted(() => ({ findUnique: vi.fn() }));
const timingState = vi.hoisted(() => ({ count: 0 }));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '10.0.0.5', 'user-agent': 'vitest' }),
}));

vi.mock('@/shared/env', () => ({
  env: {
    get AUTH_LOGIN_ENABLED() {
      return envState.loginEnabled;
    },
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-test',
    SUPABASE_SERVICE_ROLE_KEY: 'service-test',
    AUTH_ATTEMPTS_RETENTION_DAYS: 90,
  },
}));

vi.mock('@/modules/audit', () => ({
  AuditEvent: {
    AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
    AUTH_LOGIN_FAILURE: 'AUTH_LOGIN_FAILURE',
  },
  withAudit: async (
    event: string,
    fn: (tx: unknown, audit: Record<string, unknown>) => Promise<unknown>,
  ) => {
    auditState.events.push(event);
    return fn({}, {});
  },
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { person: { findUnique: (...args: unknown[]) => prismaState.findUnique(...args) } },
}));

vi.mock('../domain/anti-timing', () => ({
  consumeTimingBudget: () => {
    timingState.count++;
  },
  DUMMY_HASH: 'x',
}));

const { container } = await import('@/shared/container');
const { AUTH_PROVIDER_TOKEN } = await import('../ports/authProvider');
const { AUTH_ATTEMPTS_REPO_TOKEN } = await import('../ports/authAttemptsRepo');
const { CAPTCHA_VERIFIER_TOKEN } = await import('../ports/captchaVerifier');
const { loginAction } = await import('../actions/login');
const { GENERIC_AUTH_ERROR } = await import('../schemas/signIn');

// ── Fakes dos ports ──────────────────────────────────────────────────────────
const signInWithPassword = vi.fn();
const signOut = vi.fn(async () => {});
const recordAttempt = vi.fn(async () => {});
const resetAttempts = vi.fn(async () => {});
const recentAttempts = vi.fn(
  async () => [] as { outcome: 'SUCCESS' | 'FAILURE'; attemptedAt: Date }[],
);
// CAPTCHA adaptativo (H1, Fase 6 — hardening): stub controlável por teste.
const captchaVerify = vi.fn(async () => ({ ok: true }));

function registerFakes() {
  container.register(AUTH_PROVIDER_TOKEN, () => ({ signInWithPassword, signOut }));
  container.register(AUTH_ATTEMPTS_REPO_TOKEN, () => ({
    record: recordAttempt,
    reset: resetAttempts,
    recent: recentAttempts,
  }));
  container.register(CAPTCHA_VERIFIER_TOKEN, () => ({ verify: captchaVerify }));
}

/** N tentativas FALHAS "agora" — suficiente para cruzar qualquer limiar (H1/lockout). */
function failures(n: number): { outcome: 'FAILURE'; attemptedAt: Date }[] {
  return Array.from({ length: n }, () => ({ outcome: 'FAILURE' as const, attemptedAt: new Date() }));
}

const VALID = { email: 'maria@example.com', senha: 'senha1234' };

beforeEach(() => {
  vi.clearAllMocks();
  envState.loginEnabled = true;
  auditState.events = [];
  timingState.count = 0;
  recentAttempts.mockResolvedValue([]);
  registerFakes();
});

describe('loginAction', () => {
  it('happy path: credenciais válidas → ok, redireciona a /inicio, audita sucesso e reseta tentativas', async () => {
    signInWithPassword.mockResolvedValue({ ok: true, userId: 'user-1' });
    prismaState.findUnique.mockResolvedValue({
      id: 'person-1',
      status: 'ATIVO',
      credential: { primeiroAcesso: false },
    });

    const result = await loginAction(VALID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.redirectTo).toBe('/inicio');
      expect(result.data.primeiroAcesso).toBe(false);
    }
    expect(auditState.events).toContain('AUTH_LOGIN_SUCCESS');
    expect(recordAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'SUCCESS' }),
      expect.anything(),
    );
    expect(resetAttempts).toHaveBeenCalled();
  });

  it('1º acesso: credential.primeiroAcesso=true → redireciona a /trocar-senha', async () => {
    signInWithPassword.mockResolvedValue({ ok: true, userId: 'user-1' });
    prismaState.findUnique.mockResolvedValue({
      id: 'person-1',
      status: 'ATIVO',
      credential: { primeiroAcesso: true },
    });

    const result = await loginAction(VALID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.redirectTo).toBe('/trocar-senha');
      expect(result.data.primeiroAcesso).toBe(true);
    }
  });

  it('input inválido (e-mail malformado) → VALIDATION, sem chamar o provedor', async () => {
    const result = await loginAction({ email: 'nao-email', senha: 'senha1234' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('input inválido (senha curta) → VALIDATION', async () => {
    const result = await loginAction({ email: 'maria@example.com', senha: '123' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('lockout ativo → INVALID_CREDENTIALS, audita falha e NÃO chama o provedor', async () => {
    const now = Date.now();
    recentAttempts.mockResolvedValue(
      Array.from({ length: 5 }, () => ({ outcome: 'FAILURE' as const, attemptedAt: new Date(now) })),
    );

    const result = await loginAction(VALID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_CREDENTIALS');
      expect(result.error.message).toBe(GENERIC_AUTH_ERROR);
    }
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(auditState.events).toContain('AUTH_LOGIN_FAILURE');
    expect(recordAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'FAILURE' }),
      expect.anything(),
    );
  });

  it('e-mail inexistente → INVALID_CREDENTIALS + gasta orçamento de timing (anti-enumeração)', async () => {
    signInWithPassword.mockResolvedValue({ ok: false });
    prismaState.findUnique.mockResolvedValue(null); // nenhuma Pessoa com este e-mail

    const result = await loginAction(VALID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_CREDENTIALS');
    expect(timingState.count).toBe(1); // consumeTimingBudget chamado
    expect(auditState.events).toContain('AUTH_LOGIN_FAILURE');
  });

  it('senha errada (Pessoa existe) → INVALID_CREDENTIALS, sem gastar orçamento de timing', async () => {
    signInWithPassword.mockResolvedValue({ ok: false });
    prismaState.findUnique.mockResolvedValue({ id: 'person-1' });

    const result = await loginAction(VALID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_CREDENTIALS');
    expect(timingState.count).toBe(0); // caminho de senha errada já gastou bcrypt no provedor
    expect(auditState.events).toContain('AUTH_LOGIN_FAILURE');
  });

  it('Pessoa INATIVA → INVALID_CREDENTIALS, encerra a sessão (signOut) e audita falha', async () => {
    signInWithPassword.mockResolvedValue({ ok: true, userId: 'user-1' });
    prismaState.findUnique.mockResolvedValue({
      id: 'person-1',
      status: 'INATIVO',
      credential: { primeiroAcesso: false },
    });

    const result = await loginAction(VALID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_CREDENTIALS');
    expect(signOut).toHaveBeenCalled();
    expect(auditState.events).toContain('AUTH_LOGIN_FAILURE');
    expect(auditState.events).not.toContain('AUTH_LOGIN_SUCCESS');
  });

  it('feature flag AUTH_LOGIN_ENABLED=false → MAINTENANCE', async () => {
    envState.loginEnabled = false;
    const result = await loginAction(VALID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('MAINTENANCE');
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('loginAction — CAPTCHA adaptativo (H1, Fase 6 hardening, MN-H1)', () => {
  it('AC-H1-1: 0–2 falhas recentes → login normal, sem CAPTCHA (fricção zero)', async () => {
    recentAttempts.mockResolvedValue(failures(2));
    signInWithPassword.mockResolvedValue({ ok: true, userId: 'user-1' });
    prismaState.findUnique.mockResolvedValue({
      id: 'person-1',
      status: 'ATIVO',
      credential: { primeiroAcesso: false },
    });

    const result = await loginAction(VALID);

    expect(result.ok).toBe(true);
    expect(captchaVerify).not.toHaveBeenCalled();
    expect(signInWithPassword).toHaveBeenCalled();
  });

  it('MN-H1: ≥3 falhas + sem captchaToken → CAPTCHA_REQUIRED, provedor NÃO chamado, nenhum AuthAttempt novo gravado', async () => {
    recentAttempts.mockResolvedValue(failures(3));
    // Sem token, o verificador real (Turnstile) sempre rejeita — o stub espelha
    // esse fail-closed explicitamente (ausência de token nunca deveria "passar").
    captchaVerify.mockResolvedValueOnce({ ok: false });

    const result = await loginAction(VALID); // sem captchaToken

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CAPTCHA_REQUIRED');
    expect(captchaVerify).toHaveBeenCalledWith(undefined, expect.any(String));
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(recordAttempt).not.toHaveBeenCalled();
  });

  it('MN-H1: ≥3 falhas + captchaToken rejeitado pelo verificador → CAPTCHA_REQUIRED, provedor NÃO chamado', async () => {
    recentAttempts.mockResolvedValue(failures(4));
    captchaVerify.mockResolvedValueOnce({ ok: false });

    const result = await loginAction({ ...VALID, captchaToken: 'token-invalido' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CAPTCHA_REQUIRED');
    expect(captchaVerify).toHaveBeenCalledWith('token-invalido', expect.any(String));
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(recordAttempt).not.toHaveBeenCalled();
  });

  it('AC-H1-3: ≥3 falhas + captchaToken verificado → prossegue para a autenticação normal', async () => {
    recentAttempts.mockResolvedValue(failures(3));
    captchaVerify.mockResolvedValueOnce({ ok: true });
    signInWithPassword.mockResolvedValue({ ok: true, userId: 'user-1' });
    prismaState.findUnique.mockResolvedValue({
      id: 'person-1',
      status: 'ATIVO',
      credential: { primeiroAcesso: false },
    });

    const result = await loginAction({ ...VALID, captchaToken: 'token-valido' });

    expect(result.ok).toBe(true);
    expect(captchaVerify).toHaveBeenCalledWith('token-valido', expect.any(String));
    expect(signInWithPassword).toHaveBeenCalled();
  });

  it('ordem preservada: ≥5 falhas continua LOCKED (lockout checado antes do CAPTCHA)', async () => {
    recentAttempts.mockResolvedValue(failures(5));

    const result = await loginAction(VALID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_CREDENTIALS');
    expect(captchaVerify).not.toHaveBeenCalled();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
