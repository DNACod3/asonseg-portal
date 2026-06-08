import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Testes do View Model `viewPersonForStaff` (USP-007). Espelha o padrão de
 * mocking de `reporting/__tests__/access-report.test.ts`: estado hoisted +
 * `vi.mock('@/shared/lib/prisma')`, com `await import(...)` da view APÓS o mock.
 *
 * Cobre: o mapeamento (status, papéis ATIVOS, ISO/null dos metadados de
 * inativação), o `null` quando a Pessoa não existe e — o ponto crítico de
 * privacidade (P-006 / USP-036) — a garantia de que a View **não vaza** campos
 * sensíveis da ficha social: o `select` não os pede e a saída só expõe o
 * whitelist operacional, ainda que a linha trouxesse CPF/e-mail/telefone.
 */

const prismaState = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { person: { findUnique: (...args: unknown[]) => prismaState.findUnique(...args) } },
}));

const { viewPersonForStaff } = await import('../views/view-person-for-staff');

const PERSON_ID = '11111111-1111-4111-8111-111111111111';

/** Campos que JAMAIS podem aparecer na View (ficha social — visibilidade restrita). */
const SENSITIVE_KEYS = [
  'cpf',
  'emailLogin',
  'phone',
  'birthDate',
  'fullAddress',
  'cpfExceptionJustification',
  'supabaseUserId',
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('viewPersonForStaff', () => {
  it('mapeia Pessoa ATIVA: status, papéis ativos e metadados de inativação nulos', async () => {
    prismaState.findUnique.mockResolvedValue({
      id: PERSON_ID,
      fullName: 'Maria da Silva',
      status: 'ATIVO',
      inactivatedAt: null,
      inactivationReason: null,
      roleGrants: [{ role: 'VOLUNTEER' }, { role: 'COORDINATOR' }],
    });

    const view = await viewPersonForStaff(PERSON_ID);

    expect(view).toEqual({
      id: PERSON_ID,
      fullName: 'Maria da Silva',
      status: 'ATIVO',
      roles: ['VOLUNTEER', 'COORDINATOR'],
      inactivatedAt: null,
      inactivationReason: null,
    });
  });

  it('mapeia Pessoa INATIVA: inactivatedAt vira ISO 8601 e o motivo é preservado', async () => {
    prismaState.findUnique.mockResolvedValue({
      id: PERSON_ID,
      fullName: 'João Souza',
      status: 'INATIVO',
      inactivatedAt: new Date('2026-06-01T15:30:00Z'),
      inactivationReason: 'Encerramento de vínculo.',
      roleGrants: [],
    });

    const view = await viewPersonForStaff(PERSON_ID);

    expect(view?.status).toBe('INATIVO');
    expect(view?.inactivatedAt).toBe('2026-06-01T15:30:00.000Z');
    expect(view?.inactivationReason).toBe('Encerramento de vínculo.');
    expect(view?.roles).toEqual([]);
  });

  it('devolve null quando a Pessoa não existe', async () => {
    prismaState.findUnique.mockResolvedValue(null);
    expect(await viewPersonForStaff(PERSON_ID)).toBeNull();
  });

  it('privacidade: a saída expõe só o whitelist operacional, nunca a ficha social (P-006)', async () => {
    // A linha "vaza" campos sensíveis de propósito — a View não deve repassá-los.
    prismaState.findUnique.mockResolvedValue({
      id: PERSON_ID,
      fullName: 'Maria da Silva',
      status: 'ATIVO',
      inactivatedAt: null,
      inactivationReason: null,
      roleGrants: [{ role: 'CANDIDATE' }],
      cpf: '123.456.789-00',
      emailLogin: 'maria@example.com',
      phone: '+55 11 99999-0000',
      birthDate: new Date('1990-01-01T00:00:00Z'),
      fullAddress: 'Rua X, 123',
      cpfExceptionJustification: 'sigiloso',
      supabaseUserId: 'supa-123',
    });

    const view = await viewPersonForStaff(PERSON_ID);

    expect(Object.keys(view ?? {}).sort()).toEqual(
      ['fullName', 'id', 'inactivatedAt', 'inactivationReason', 'roles', 'status'].sort(),
    );
    for (const key of SENSITIVE_KEYS) {
      expect(view).not.toHaveProperty(key);
    }
  });

  it('consulta com select explícito: pede só o necessário, papéis ATIVOS e com take', async () => {
    prismaState.findUnique.mockResolvedValue({
      id: PERSON_ID,
      fullName: 'Maria',
      status: 'ATIVO',
      inactivatedAt: null,
      inactivationReason: null,
      roleGrants: [],
    });

    await viewPersonForStaff(PERSON_ID);

    expect(prismaState.findUnique).toHaveBeenCalledTimes(1);
    const arg = prismaState.findUnique.mock.calls[0]?.[0] as {
      where: { id: string };
      select: Record<string, unknown> & {
        roleGrants: { where: { status: string }; take: number };
      };
    };
    expect(arg.where).toEqual({ id: PERSON_ID });
    // Não pede nenhum campo sensível da ficha social.
    for (const key of SENSITIVE_KEYS) {
      expect(arg.select).not.toHaveProperty(key);
    }
    // Papéis: só ATIVOS e com paginação defensiva.
    expect(arg.select.roleGrants.where).toEqual({ status: 'ACTIVE' });
    expect(arg.select.roleGrants.take).toBeGreaterThan(0);
  });
});
