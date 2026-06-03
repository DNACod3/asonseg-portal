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

const auditState = vi.hoisted(() => ({ events: [] as string[] }));
const prismaState = vi.hoisted(() => ({ findUnique: vi.fn() }));
const emailState = vi.hoisted(() => ({ send: vi.fn() }));
const supaState = vi.hoisted(() => ({
  generateLink: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest' }),
}));

vi.mock('@/shared/container', () => ({
  createToken: (d: string) => Symbol(d),
  container: { resolve: () => ({ send: (...a: unknown[]) => emailState.send(...a) }) },
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
    const tx = { credential: { update: vi.fn(async () => ({})) } };
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
});

// ── Schemas ───────────────────────────────────────────────────────────────────

describe('schemas de recuperação de senha', () => {
  it('solicitação: normaliza e-mail (lowercase + trim)', () => {
    const parsed = requestPasswordResetSchema.safeParse({ email: '  Maria@Example.COM ' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe('maria@example.com');
  });
  it('solicitação: rejeita e-mail inválido', () => {
    expect(requestPasswordResetSchema.safeParse({ email: 'nao-email' }).success).toBe(false);
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
    const result = await requestPasswordReset({ email: 'maria@example.com' });

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

    const result = await requestPasswordReset({ email: 'ninguem@example.com' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.message).toBe(GENERIC_RESET_REQUEST_MESSAGE);
    expect(supaState.generateLink).not.toHaveBeenCalled();
    expect(emailState.send).not.toHaveBeenCalled();
    expect(auditState.events).toHaveLength(0);
  });

  it('mensagem é idêntica para e-mail existente e inexistente (anti-enumeração)', async () => {
    const existente = await requestPasswordReset({ email: 'maria@example.com' });
    prismaState.findUnique.mockResolvedValueOnce(null);
    const inexistente = await requestPasswordReset({ email: 'ninguem@example.com' });

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
    const result = await requestPasswordReset({ email: 'inativo@example.com' });
    expect(result.ok).toBe(true);
    expect(emailState.send).not.toHaveBeenCalled();
  });

  it('falha ao gerar o link → ainda devolve mensagem genérica, sem e-mail', async () => {
    supaState.generateLink.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const result = await requestPasswordReset({ email: 'maria@example.com' });
    expect(result.ok).toBe(true);
    expect(emailState.send).not.toHaveBeenCalled();
  });

  it('formato inválido → VALIDATION', async () => {
    const result = await requestPasswordReset({ email: 'nao-email' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });
});

// ── resetPassword ─────────────────────────────────────────────────────────────

describe('resetPassword', () => {
  const VALID = { token: 'hashed-abc', senhaNova: 'novaSenha123', confirmar: 'novaSenha123' };

  it('token válido → atualiza senha, audita, encerra sessão e redireciona ao login', async () => {
    const result = await resetPassword(VALID);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.redirectTo).toContain('/login');
    expect(supaState.verifyOtp).toHaveBeenCalledWith({ token_hash: 'hashed-abc', type: 'recovery' });
    expect(supaState.updateUser).toHaveBeenCalledWith({ password: 'novaSenha123' });
    expect(supaState.signOut).toHaveBeenCalledTimes(1);
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
