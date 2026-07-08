import { prisma } from '@/shared/lib/prisma';
import { viewStaffPersonNames } from '@/modules/persons';
import type { TaxonomySuggestionItem } from '../views/taxonomy-suggestion-item';

/** Limite de itens por tipo (poucas dezenas esperadas no MVP — L-001). */
const SUGGESTIONS_PAGE_SIZE = 200;

interface SuggestionRow {
  id: string;
  name: string;
  suggestedBy: string | null;
  createdAt: Date;
}

/**
 * Fila de sugestões de taxonomia pendentes (USP-019 / SUGG-06): áreas de vaga
 * + categorias de serviço, mescladas e ordenadas por `createdAt desc`.
 * Pendente = `isSuggestion=true AND approvedAt IS NULL` (aprovadas e
 * rejeitadas — linha ausente — nunca aparecem aqui).
 */
export async function listTaxonomySuggestions(): Promise<TaxonomySuggestionItem[]> {
  const [areaRows, categoryRows] = await Promise.all([
    prisma.jobArea.findMany({
      where: { isSuggestion: true, approvedAt: null },
      select: { id: true, name: true, suggestedBy: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: SUGGESTIONS_PAGE_SIZE,
    }),
    prisma.serviceCategory.findMany({
      where: { isSuggestion: true, approvedAt: null },
      select: { id: true, name: true, suggestedBy: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: SUGGESTIONS_PAGE_SIZE,
    }),
  ]);

  const rows: (SuggestionRow & { kind: 'JOB_AREA' | 'SERVICE_CATEGORY' })[] = [
    ...areaRows.map((r) => ({ ...r, kind: 'JOB_AREA' as const })),
    ...categoryRows.map((r) => ({ ...r, kind: 'SERVICE_CATEGORY' as const })),
  ];

  if (rows.length === 0) return [];

  // Nome do autor via View Model de staff do módulo `persons` (ADR-0010) — nunca
  // lemos `Person` direto de outro módulo. Uma única consulta (evita N+1).
  const suggesterIds = rows.map((r) => r.suggestedBy).filter((id): id is string => id !== null);
  const nameById = await viewStaffPersonNames(suggesterIds);

  return rows
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      suggestedByName: r.suggestedBy ? (nameById.get(r.suggestedBy) ?? null) : null,
      createdAt: r.createdAt,
    }));
}
