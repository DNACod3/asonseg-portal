/**
 * Domínio puro da sugestão de taxonomia (USP-019 — AD-013). Sem IO: tipos e a
 * regra de dedup normalizado, reusados pelo schema Zod e pelas Server Actions.
 *
 * A persistência (`JobArea`/`ServiceCategory`) já existe no schema (mesma forma
 * — `isSuggestion`/`suggestedBy`/`approvedAt`/`approvedBy`/`name @unique`); este
 * arquivo não a redecide, só nomeia o seletor (`TaxonomyKind`) que escolhe entre
 * as duas tabelas nas actions.
 */

/** Tipo de taxonomia sugerível — os dois delegates Prisma de forma idêntica. */
export type TaxonomyKind = 'JOB_AREA' | 'SERVICE_CATEGORY';

export const TAXONOMY_NAME_MIN = 2;
export const TAXONOMY_NAME_MAX = 60;

/**
 * Normaliza um nome para comparação de duplicata (SUGG-05/SUGG-MN-03):
 * `trim` + colapsa espaços internos + `toLowerCase` + remove acentos
 * (`normalize('NFD')` + strip diacríticos). Determinístico, sem locale
 * surpresa — "Tecnologia", "tecnologia", "tecnologìa" e "  tecnologia  "
 * normalizam para o mesmo valor; "TI" não casa com "Tecnologia".
 */
export function foldForDedup(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
