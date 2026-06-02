import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Testes da query `listOwnConsents` (USP-043 / #39) com Prisma mockado.
 *
 * O foco é o **contrato de privacidade** (a query é estritamente filtrada pelo
 * `personId` do titular autenticado — nunca vaza dados de outra Pessoa) e as
 * convenções Prisma obrigatórias (paginação `take`, `select` explícito,
 * ordenação determinística). O View Model `buildOwnConsentsView` é coberto à
 * parte; aqui isolamos a leitura.
 */

const prismaState = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { consent: { findMany: (...args: unknown[]) => prismaState.findMany(...args) } },
}));

const { listOwnConsents } = await import('../queries/list-own-consents');

const PERSON_ID = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  prismaState.findMany.mockReset();
});

describe('consents/listOwnConsents', () => {
  it('filtra estritamente pelo personId do titular (privacidade)', async () => {
    prismaState.findMany.mockResolvedValue([]);

    await listOwnConsents(PERSON_ID);

    const args = prismaState.findMany.mock.calls[0]?.[0];
    expect(args.where).toEqual({ personId: PERSON_ID });
  });

  it('aplica paginação (take: 200), ordenação determinística e select explícito', async () => {
    prismaState.findMany.mockResolvedValue([]);

    await listOwnConsents(PERSON_ID);

    const args = prismaState.findMany.mock.calls[0]?.[0];
    expect(args.take).toBe(200);
    expect(args.orderBy).toEqual({ acceptedAt: 'desc' });
    // Não puxa a linha inteira: só os campos que o painel consome.
    expect(args.select).toEqual({
      id: true,
      purpose: true,
      termVersion: true,
      acceptedAt: true,
      revokedAt: true,
    });
  });

  it('repassa as linhas retornadas pelo Prisma', async () => {
    const rows = [
      {
        id: 'c1',
        purpose: 'JOB_APPLICATION',
        termVersion: 'v1.0',
        acceptedAt: new Date('2026-05-01T12:00:00Z'),
        revokedAt: null,
      },
    ];
    prismaState.findMany.mockResolvedValue(rows);

    const result = await listOwnConsents(PERSON_ID);

    expect(result).toEqual(rows);
  });
});
