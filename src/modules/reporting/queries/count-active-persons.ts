import { prisma } from '@/shared/lib/prisma';

/**
 * Contagem de Pessoas com `status = ATIVO`, para o KPI "pessoas ativas" do
 * bloco BOARD do painel `/inicio` (USP-067 — PNL-07 / A-12). Count-only
 * (PII-free) — distinto de `getHomeIndicators().activeCandidates`, que conta
 * perfis de candidato publicados, não Pessoas.
 */
export async function countActivePersons(): Promise<number> {
  return prisma.person.count({ where: { status: 'ATIVO' } });
}
