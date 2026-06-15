// Unit da query read-only de convites de vínculo de responsável pendentes
// (USP-013) — Prisma mockado. Cobre a barreira de autorização (o `where` por
// `personId` + estado PENDING), o mapeamento sem PII de terceiros (P-001) e o
// fallback de `pendingAt` nulo. O fuso é fixado em São Paulo por `formatSaoPaulo`,
// então a asserção do label é determinística independente do TZ da máquina.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const prismaState = vi.hoisted(() => ({
  grantFindMany: vi.fn(),
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    personCompanyGrant: { findMany: (...a: unknown[]) => prismaState.grantFindMany(...a) },
  },
}));

const { listPendingResponsibleLinks } = await import('../list-pending-responsible-links');

const PERSON = '11111111-1111-4111-8111-111111111111';
const EMPRESA_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listPendingResponsibleLinks', () => {
  it('consulta só os convites PENDING não revogados da própria Pessoa, mais recentes primeiro, paginado', async () => {
    prismaState.grantFindMany.mockResolvedValue([]);

    await listPendingResponsibleLinks(PERSON);

    const arg = prismaState.grantFindMany.mock.calls[0]?.[0] as {
      where: { personId: string; grantType: string; status: string; revokedAt: null };
      orderBy: { pendingAt: 'desc' };
      take: number;
    };
    // O `where` é a barreira de autorização: cada Pessoa só enxerga os seus.
    expect(arg.where).toEqual({
      personId: PERSON,
      grantType: 'RESPONSIBLE',
      status: 'PENDING',
      revokedAt: null,
    });
    expect(arg.orderBy).toEqual({ pendingAt: 'desc' });
    expect(arg.take).toBeGreaterThan(0); // paginação defensiva obrigatória
  });

  it('mapeia para empresaId + nome fantasia + data formatada em São Paulo (sem PII de terceiros)', async () => {
    prismaState.grantFindMany.mockResolvedValue([
      {
        companyId: EMPRESA_A,
        pendingAt: new Date('2026-06-10T18:30:00Z'), // São Paulo (UTC-3): 15:30
        company: { id: EMPRESA_A, nomeFantasia: 'Padaria do Zé' },
      },
      {
        companyId: EMPRESA_B,
        pendingAt: new Date('2026-06-09T12:00:00Z'), // São Paulo: 09:00
        company: { id: EMPRESA_B, nomeFantasia: 'Oficina Bom Conserto' },
      },
    ]);

    const out = await listPendingResponsibleLinks(PERSON);

    expect(out).toEqual([
      { empresaId: EMPRESA_A, empresaNome: 'Padaria do Zé', pendingAtLabel: '10/06/2026 às 15:30' },
      { empresaId: EMPRESA_B, empresaNome: 'Oficina Bom Conserto', pendingAtLabel: '09/06/2026 às 09:00' },
    ]);
  });

  it('sem convites pendentes: lista vazia', async () => {
    prismaState.grantFindMany.mockResolvedValue([]);
    expect(await listPendingResponsibleLinks(PERSON)).toEqual([]);
  });

  it('pendingAt nulo (nullable no schema): usa fallback "—" sem quebrar', async () => {
    prismaState.grantFindMany.mockResolvedValue([
      { companyId: EMPRESA_A, pendingAt: null, company: { id: EMPRESA_A, nomeFantasia: 'Padaria do Zé' } },
    ]);

    const out = await listPendingResponsibleLinks(PERSON);

    expect(out).toEqual([{ empresaId: EMPRESA_A, empresaNome: 'Padaria do Zé', pendingAtLabel: '—' }]);
  });
});
