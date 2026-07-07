import { z } from 'zod';
import { TAXONOMY_NAME_MAX, TAXONOMY_NAME_MIN } from '../domain/taxonomy-suggestion';

/** `kind` da taxonomia sugerível (USP-019 / SUGG-08). */
const taxonomyKind = z.enum(['JOB_AREA', 'SERVICE_CATEGORY']);

/** Entrada de `suggestTaxonomy` — nome livre, trim + limites (SUGG edges de tamanho/vazio). */
export const suggestTaxonomySchema = z.object({
  kind: taxonomyKind,
  name: z
    .string()
    .trim()
    .min(TAXONOMY_NAME_MIN, `O nome deve ter ao menos ${TAXONOMY_NAME_MIN} caracteres.`)
    .max(TAXONOMY_NAME_MAX, `O nome deve ter no máximo ${TAXONOMY_NAME_MAX} caracteres.`),
});

/** Entrada de `approveTaxonomySuggestion`/`rejectTaxonomySuggestion` — motivo de rejeição opcional. */
export const resolveTaxonomySuggestionSchema = z.object({
  kind: taxonomyKind,
  id: z.string().uuid('Sugestão inválida.'),
  reason: z.string().trim().max(280, 'O motivo deve ter no máximo 280 caracteres.').optional(),
});

export type SuggestTaxonomyInput = z.infer<typeof suggestTaxonomySchema>;
export type ResolveTaxonomySuggestionInput = z.infer<typeof resolveTaxonomySuggestionSchema>;
