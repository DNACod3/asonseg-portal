// Unit da query read-only dos responsáveis ATIVOS de uma Empresa (USP-014) —
// Prisma mockado. Cobre o `where` (só ACTIVE não-revogados), a paginação
// defensiva, o `select` explícito (sem N+1 / sem PII além do nome) e a marcação
// do vínculo do próprio ator (isSelf).

import { describe, it, expect, beforeEach, vi } from 'vitest';

const prismaState = vi.hoisted(() => ({
  grantFindMany: vi.fn(),
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    personCompanyGrant: { findMany: (...a: unknown[]) => prismaState.grantFindMany(...a) },
  },
}));

const { listActiveResponsibles } = await import('../list-active-responsibles');

const EMPRESA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SELF = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listActiveResponsibles', () => {
  it('consulta só responsáveis ACTIVE não revogados da Empresa, paginado', async () => {
    prismaState.grantFindMany.mockResolvedValue([]);

    await listActiveResponsibles(EMPRESA, SELF);

    const arg = prismaState.grantFindMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      take: number;
      select: Record<string, unknown>;
    };
    expect(arg.where).toEqual({
      companyId: EMPRESA,
      grantType: 'RESPONSIBLE',
      status: 'ACTIVE',
      revokedAt: null,
    });
    expect(arg.take).toBeGreaterThan(0); // paginação defensiva obrigatória
    expect(arg.select).toBeDefined(); // select explícito (sem N+1)
  });

  it('mapeia grantId + nome + isSelf, marcando o vínculo do próprio ator', async () => {
    prismaState.grantFindMany.mockResolvedValue([
      { id: 'g1', personId: SELF, person: { fullName: 'Ana Responsável' } },
      { id: 'g2', personId: OTHER, person: { fullName: 'Bruno Co-resp' } },
    ]);

    const out = await listActiveResponsibles(EMPRESA, SELF);

    expect(out).toEqual([
      { grantId: 'g1', nome: 'Ana Responsável', isSelf: true },
      { grantId: 'g2', nome: 'Bruno Co-resp', isSelf: false },
    ]);
  });

  it('sem responsáveis: lista vazia', async () => {
    prismaState.grantFindMany.mockResolvedValue([]);
    expect(await listActiveResponsibles(EMPRESA, SELF)).toEqual([]);
  });
});
