import { describe, it, expect, beforeEach, vi } from 'vitest';
import { changePasswordFirstAccessSchema } from '../schemas/changePassword';

/**
 * Testes da troca de senha no 1º acesso (USP-004 — T-09): schema (força/confirmação)
 * + Server Action com Supabase, Prisma e auditoria mockados.
 */

const auditState = vi.hoisted(() => ({ events: [] as string[] }));
const prismaState = vi.hoisted(() => ({ findUnique: vi.fn() }));
const supaState = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest' }),
}));

vi.mock('@/shared/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: (...a: unknown[]) => supaState.getUser(...a),
      updateUser: (...a: unknown[]) => supaState.updateUser(...a),
    },
  }),
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { person: { findUnique: (...a: unknown[]) => prismaState.findUnique(...a) } },
}));

vi.mock('@/modules/audit', () => ({
  AuditEvent: { AUTH_PASSWORD_CHANGED_FIRST_ACCESS: 'AUTH_PASSWORD_CHANGED_FIRST_ACCESS' },
  withAudit: async (event: string, fn: (tx: unknown, audit: Record<string, unknown>) => Promise<unknown>) => {
    auditState.events.push(event);
    const tx = { credential: { update: vi.fn(async () => ({})) } };
    return fn(tx, {});
  },
}));

const { changePasswordFirstAccess } = await import('../actions/changePassword');

const VALID = { senhaNova: 'novaSenha123', confirmar: 'novaSenha123' };

beforeEach(() => {
  vi.clearAllMocks();
  auditState.events = [];
  supaState.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  supaState.updateUser.mockResolvedValue({ error: null });
  prismaState.findUnique.mockResolvedValue({
    id: 'person-1',
    status: 'ATIVO',
    credential: { id: 'cred-1', primeiroAcesso: true },
  });
});

describe('changePasswordFirstAccessSchema', () => {
  it('aceita senha forte com confirmação igual', () => {
    expect(changePasswordFirstAccessSchema.safeParse(VALID).success).toBe(true);
  });
  it('rejeita senha sem número', () => {
    expect(
      changePasswordFirstAccessSchema.safeParse({ senhaNova: 'apenasletras', confirmar: 'apenasletras' }).success,
    ).toBe(false);
  });
  it('rejeita senha curta', () => {
    expect(changePasswordFirstAccessSchema.safeParse({ senhaNova: 'ab1', confirmar: 'ab1' }).success).toBe(false);
  });
  it('rejeita quando a confirmação difere', () => {
    expect(
      changePasswordFirstAccessSchema.safeParse({ senhaNova: 'novaSenha123', confirmar: 'outra123' }).success,
    ).toBe(false);
  });
});

describe('changePasswordFirstAccess (action)', () => {
  it('happy path → ok, atualiza senha, baixa flag e audita', async () => {
    const result = await changePasswordFirstAccess(VALID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.redirectTo).toBe('/inicio');
    expect(supaState.updateUser).toHaveBeenCalledWith({ password: VALID.senhaNova });
    expect(auditState.events).toContain('AUTH_PASSWORD_CHANGED_FIRST_ACCESS');
  });

  it('input inválido → VALIDATION', async () => {
    const result = await changePasswordFirstAccess({ senhaNova: 'x', confirmar: 'y' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('sem sessão → UNAUTHENTICATED', async () => {
    supaState.getUser.mockResolvedValue({ data: { user: null } });
    const result = await changePasswordFirstAccess(VALID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHENTICATED');
  });

  it('Pessoa inativa → FORBIDDEN', async () => {
    prismaState.findUnique.mockResolvedValue({ id: 'p1', status: 'INATIVO', credential: { id: 'c1', primeiroAcesso: true } });
    const result = await changePasswordFirstAccess(VALID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('falha ao atualizar no provedor → INTERNAL', async () => {
    supaState.updateUser.mockResolvedValue({ error: { message: 'boom' } });
    const result = await changePasswordFirstAccess(VALID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INTERNAL');
  });
});
