import { describe, it, expect, beforeEach, vi } from 'vitest';
import { changePasswordFirstAccessSchema } from '../schemas/changePassword';

/**
 * Testes da troca de senha no 1º acesso (USP-004 — T-09): schema (força/confirmação)
 * + Server Action com `getCurrentPerson` (ADR-0030), Prisma (credencial) e
 * Supabase (`updateUser`) mockados.
 */

const auditState = vi.hoisted(() => ({ events: [] as string[] }));
const credentialUpdateSpy = vi.hoisted(() => vi.fn(async () => ({})));
const sessionState = vi.hoisted(() => ({ getCurrentPerson: vi.fn() }));
const prismaState = vi.hoisted(() => ({ findUnique: vi.fn() }));
const supaState = vi.hoisted(() => ({ updateUser: vi.fn() }));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest' }),
}));

vi.mock('../server/session', () => ({
  getCurrentPerson: (...a: unknown[]) => sessionState.getCurrentPerson(...a),
}));

vi.mock('@/shared/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      updateUser: (...a: unknown[]) => supaState.updateUser(...a),
    },
  }),
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { credential: { findUnique: (...a: unknown[]) => prismaState.findUnique(...a) } },
}));

vi.mock('@/modules/audit', () => ({
  AuditEvent: { AUTH_PASSWORD_CHANGED_FIRST_ACCESS: 'AUTH_PASSWORD_CHANGED_FIRST_ACCESS' },
  withAudit: async (event: string, fn: (tx: unknown, audit: Record<string, unknown>) => Promise<unknown>) => {
    auditState.events.push(event);
    const tx = { credential: { update: credentialUpdateSpy } };
    return fn(tx, {});
  },
}));

const { changePasswordFirstAccess } = await import('../actions/changePassword');

const VALID = { senhaNova: 'novaSenha123', confirmar: 'novaSenha123' };

beforeEach(() => {
  vi.clearAllMocks();
  auditState.events = [];
  sessionState.getCurrentPerson.mockResolvedValue({
    id: 'person-1',
    supabaseUserId: 'user-1',
    status: 'ATIVO',
  });
  supaState.updateUser.mockResolvedValue({ error: null });
  prismaState.findUnique.mockResolvedValue({ id: 'cred-1' });
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
    expect(credentialUpdateSpy).toHaveBeenCalledWith({
      where: { id: 'cred-1' },
      data: { primeiroAcesso: false },
    });
  });

  it('input inválido → VALIDATION', async () => {
    const result = await changePasswordFirstAccess({ senhaNova: 'x', confirmar: 'y' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('sem Pessoa ativa (getCurrentPerson → null) → UNAUTHENTICATED sem escrita (U4-MN-01)', async () => {
    sessionState.getCurrentPerson.mockResolvedValue(null);
    const result = await changePasswordFirstAccess(VALID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHENTICATED');
    expect(supaState.updateUser).not.toHaveBeenCalled();
    expect(auditState.events).toHaveLength(0);
    expect(credentialUpdateSpy).not.toHaveBeenCalled();
  });

  it('Pessoa ativa sem credencial → FORBIDDEN sem escrita (U4-MN-01)', async () => {
    prismaState.findUnique.mockResolvedValue(null);
    const result = await changePasswordFirstAccess(VALID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
    expect(supaState.updateUser).not.toHaveBeenCalled();
    expect(auditState.events).toHaveLength(0);
    expect(credentialUpdateSpy).not.toHaveBeenCalled();
  });

  it('falha ao atualizar no provedor → INTERNAL', async () => {
    supaState.updateUser.mockResolvedValue({ error: { message: 'boom' } });
    const result = await changePasswordFirstAccess(VALID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INTERNAL');
  });
});
