import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  requestPasswordResetSchema,
  resetPasswordSchema,
  GENERIC_RESET_REQUEST_MESSAGE,
} from '../schemas/password-reset.schema';

/**
 * Testes da recuperação de senha (USP-005 — #70): schemas + as Server Actions
 * `requestPasswordReset` / `resetPassword`, com Supabase, Prisma, auditoria e a
 * porta EmailSender mockados. Cobre os ACs: link 24h, mensagem genérica idêntica
 * (anti-enumeração), redefinição com token válido e recusa de token inválido.
 */

const auditState = vi.hoisted(() => ({ events: [] as string[], credentialUpdate: vi.fn() }));
const prismaState = vi.hoisted(() => ({ findUnique: vi.fn() }));
const emailState = vi.hoisted(() => ({ send: vi.fn() }));
const captchaState = vi.hoisted(() => ({ verify: vi.fn() }));
const supaState = vi.hoisted(() => ({
  generateLink: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest' }),
}));

// `container.resolve` distingue a porta pelo description do token (createToken
// mockado abaixo devolve Symbol(description)): CAPTCHA vs EmailSender.
vi.mock('@/shared/container', () => ({
  createToken: (d: string) => Symbol(d),
  container: {
    resolve: (token: symbol) =>
      token.description === 'CaptchaVerifier'
        ? { verify: (...a: unknown[]) => captchaState.verify(...a) }
        : { send: (...a: unknown[]) => emailState.send(...a) },
  },
}));

vi.mock('@/shared/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      verifyOtp: (...a: unknown[]) => supaState.verifyOtp(...a),
      updateUser: (...a: unknown[]) => supaState.updateUser(...a),
      signOut: (...a: unknown[]) => supaState.signOut(...a),
    },
  }),
  createSupabaseAdminClient: () => ({
    auth: { admin: { generateLink: (...a: unknown[]) => supaState.generateLink(...a) } },
  }),
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { person: { findUnique: (...a: unknown[]) => prismaState.findUnique(...a) } },
}));

vi.mock('@/modules/audit', () => ({
  AuditEvent: {
    AUTH_PASSWORD_RESET_REQUESTED: 'AUTH_PASSWORD_RESET_REQUESTED',
    AUTH_PASSWORD_RESET_COMPLETED: 'AUTH_PASSWORD_RESET_COMPLETED',
  },
  withAudit: async (
    event: string,
    fn: (tx: unknown, audit: Record<string, unknown>) => Promise<unknown>,
  ) => {
    auditState.events.push(event);
    const tx = { credential: { update: auditState.credentialUpdate } };
    return fn(tx, {});
  },
}));

const { requestPasswordReset } = await import('../actions/request-password-reset');
const { resetPassword } = await import('../actions/reset-password');

beforeEach(() => {
  vi.clearAllMocks();
  auditState.events = [];
  prismaState.findUnique.mockResolvedValue({
    id: 'p1',
    status: 'ATIVO',
    fullName: 'Maria Silva',
    supabaseUserId: 'u1',
    credential: { id: 'c1', primeiroAcesso: false },
  });
  supaState.generateLink.mockResolvedValue({
    data: { properties: { hashed_token: 'hashed-abc' } },
    error: null,
  });
  supaState.verifyOtp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  supaState.updateUser.mockResolvedValue({ error: null });
  supaState.signOut.mockResolvedValue(undefined);
  emailState.send.mockResolvedValue({ ok: true, id: 'e1' });
  captchaState.verify.mockResolvedValue({ ok: true });
});

// ── Schemas ───────────────────────────────────────────────────────────────────

describe('schemas de recuperação de senha', () => {
  it('solicitação: normaliza e-mail (lowercase + trim)', () => {
    const parsed = requestPasswordResetSchema.safeParse({
      email: '  Maria@Example.COM ',
      captchaToken: 'captcha-ok',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe('maria@example.com');
  });
  it('solicitação: rejeita e-mail inválido', () => {
    expect(
      requestPasswordResetSchema.safeParse({ email: 'nao-email', captchaToken: 'captcha-ok' }).success,
    ).toBe(false);
  });
  it('solicitação: rejeita sem CAPTCHA', () => {
    expect(requestPasswordResetSchema.safeParse({ email: 'maria@example.com' }).success).toBe(false);
    expect(
      requestPasswordResetSchema.safeParse({ email: 'maria@example.com', captchaToken: '' }).success,
    ).toBe(false);
  });
  it('redefinição: aceita token + senha forte com confirmação igual', () => {
    expect(
      resetPasswordSchema.safeParse({ token: 't', senhaNova: 'novaSenha123', confirmar: 'novaSenha123' }).success,
    ).toBe(true);
  });
  it('redefinição: rejeita senha fraca e confirmação divergente e token vazio', () => {
    expect(resetPasswordSchema.safeParse({ token: 't', senhaNova: 'fraca', confirmar: 'fraca' }).success).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ token: 't', senhaNova: 'novaSenha123', confirmar: 'outra123' }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ token: '', senhaNova: 'novaSenha123', confirmar: 'novaSenha123' }).success,
    ).toBe(false);
  });
});

// ── requestPasswordReset ────────────────────────────────────────────────────

describe('requestPasswordReset', () => {
  it('e-mail existente → gera link, envia e-mail, audita e devolve mensagem genérica', async () => {
    const result = await requestPasswordReset({ email: 'maria@example.com', captchaToken: 'captcha-ok' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.message).toBe(GENERIC_RESET_REQUEST_MESSAGE);
    expect(supaState.generateLink).toHaveBeenCalledWith({ type: 'recovery', email: 'maria@example.com' });
    expect(emailState.send).toHaveBeenCalledTimes(1);
    const msg = emailState.send.mock.calls[0]?.[0] as {
      template: string;
      data: { resetUrl: string; expiraEmHoras: number };
    };
    expect(msg.template).toBe('password-reset');
    expect(msg.data.resetUrl).toContain('token_hash=hashed-abc');
    expect(msg.data.expiraEmHoras).toBe(24);
    expect(auditState.events).toContain('AUTH_PASSWORD_RESET_REQUESTED');
  });

  it('e-mail inexistente → mesma mensagem genérica, sem link/e-mail/auditoria', async () => {
    prismaState.findUnique.mockResolvedValueOnce(null);

    const result = await requestPasswordReset({ email: 'ninguem@example.com', captchaToken: 'captcha-ok' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.message).toBe(GENERIC_RESET_REQUEST_MESSAGE);
    expect(supaState.generateLink).not.toHaveBeenCalled();
    expect(emailState.send).not.toHaveBeenCalled();
    expect(auditState.events).toHaveLength(0);
  });

  it('mensagem é idêntica para e-mail existente e inexistente (anti-enumeração)', async () => {
    const existente = await requestPasswordReset({ email: 'maria@example.com', captchaToken: 'captcha-ok' });
    prismaState.findUnique.mockResolvedValueOnce(null);
    const inexistente = await requestPasswordReset({ email: 'ninguem@example.com', captchaToken: 'captcha-ok' });

    expect(existente.ok && inexistente.ok).toBe(true);
    if (existente.ok && inexistente.ok) {
      expect(existente.data.message).toBe(inexistente.data.message);
    }
  });

  it('Pessoa inativa → no-op (mensagem genérica, sem envio)', async () => {
    prismaState.findUnique.mockResolvedValueOnce({
      id: 'p1',
      status: 'INATIVO',
      fullName: 'X',
      supabaseUserId: 'u1',
    });
    const result = await requestPasswordReset({ email: 'inativo@example.com', captchaToken: 'captcha-ok' });
    expect(result.ok).toBe(true);
    expect(emailState.send).not.toHaveBeenCalled();
  });

  it('falha ao gerar o link → ainda devolve mensagem genérica, sem e-mail', async () => {
    supaState.generateLink.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const result = await requestPasswordReset({ email: 'maria@example.com', captchaToken: 'captcha-ok' });
    expect(result.ok).toBe(true);
    expect(emailState.send).not.toHaveBeenCalled();
  });

  it('formato inválido → VALIDATION', async () => {
    const result = await requestPasswordReset({ email: 'nao-email', captchaToken: 'captcha-ok' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('CAPTCHA inválido → PRECONDITION_FAILED, sem lookup/link/e-mail/auditoria', async () => {
    captchaState.verify.mockResolvedValueOnce({ ok: false });

    const result = await requestPasswordReset({ email: 'maria@example.com', captchaToken: 'ruim' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PRECONDITION_FAILED');
    // CAPTCHA é checado antes de tocar o banco/provedor — nada acontece.
    expect(prismaState.findUnique).not.toHaveBeenCalled();
    expect(supaState.generateLink).not.toHaveBeenCalled();
    expect(emailState.send).not.toHaveBeenCalled();
    expect(auditState.events).toHaveLength(0);
  });
});

// ── resetPassword ─────────────────────────────────────────────────────────────

describe('resetPassword', () => {
  const VALID = { token: 'hashed-abc', senhaNova: 'novaSenha123', confirmar: 'novaSenha123' };

  it('token válido → atualiza senha, audita, encerra TODAS as sessões e redireciona ao login', async () => {
    const result = await resetPassword(VALID);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.redirectTo).toContain('/login');
    expect(supaState.verifyOtp).toHaveBeenCalledWith({ token_hash: 'hashed-abc', type: 'recovery' });
    expect(supaState.updateUser).toHaveBeenCalledWith({ password: 'novaSenha123' });
    // Invalida todas as sessões do usuário (E-003 / ADR-0030), não só a de recuperação.
    expect(supaState.signOut).toHaveBeenCalledWith({ scope: 'global' });
    expect(auditState.events).toContain('AUTH_PASSWORD_RESET_COMPLETED');
    // Credencial não estava em 1º acesso → nada a baixar.
    expect(auditState.credentialUpdate).not.toHaveBeenCalled();
  });

  it('credencial em 1º acesso → conclui primeiroAcesso na mesma transação do audit', async () => {
    prismaState.findUnique.mockResolvedValueOnce({
      id: 'p1',
      credential: { id: 'c1', primeiroAcesso: true },
    });

    const result = await resetPassword(VALID);

    expect(result.ok).toBe(true);
    // Redefinir senha durante o 1º acesso baixa a flag (D-F) dentro do withAudit.
    expect(auditState.credentialUpdate).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { primeiroAcesso: false },
    });
    expect(auditState.events).toContain('AUTH_PASSWORD_RESET_COMPLETED');
  });

  it('token expirado/já usado/inválido → PRECONDITION_FAILED, sem atualizar senha', async () => {
    supaState.verifyOtp.mockResolvedValueOnce({ data: { user: null }, error: { message: 'token expired' } });

    const result = await resetPassword(VALID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PRECONDITION_FAILED');
    expect(supaState.updateUser).not.toHaveBeenCalled();
    expect(auditState.events).toHaveLength(0);
  });

  it('senha fraca → VALIDATION', async () => {
    const result = await resetPassword({ token: 'hashed-abc', senhaNova: 'fraca', confirmar: 'fraca' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('falha ao atualizar no provedor → INTERNAL', async () => {
    supaState.updateUser.mockResolvedValueOnce({ error: { message: 'boom' } });
    const result = await resetPassword(VALID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INTERNAL');
  });
});
