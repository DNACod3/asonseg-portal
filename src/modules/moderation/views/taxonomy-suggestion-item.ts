import type { TaxonomyKind } from '../domain/taxonomy-suggestion';

/**
 * Item da fila de sugestões de taxonomia pendentes (USP-019 / SUGG-06). View
 * Model: só os campos necessários para listar e decidir — o nome do autor é
 * resolvido via `viewStaffPersonNames` (módulo `persons`), nunca lendo
 * `Person` direto (ADR-0010).
 */
export interface TaxonomySuggestionItem {
  id: string;
  kind: TaxonomyKind;
  name: string;
  suggestedByName: string | null;
  createdAt: Date;
}
