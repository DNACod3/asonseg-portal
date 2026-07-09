/**
 * Regra pura (sem IO) de REF-MN-03 — resumo profissional exigido quando a
 * Pessoa não tem CV anexo (USP-037 / AC-037-3). Espelha o estilo de
 * `jobs/domain/application-rules.ts` (testável isoladamente, sem depender do DB).
 */

/**
 * WHEN a Pessoa não tem CV anexo (`hasCvAttachment === false`) e nenhum resumo
 * profissional não-vazio foi informado THEN o resumo é OBRIGATÓRIO (REF-MN-03 /
 * EC-1). Com CV anexo, o resumo nunca é exigido (independente de ter sido
 * informado ou não). `professionalSummary` só-espaços é tratado como vazio.
 */
export function isProfessionalSummaryRequired(
  hasCvAttachment: boolean,
  professionalSummary: string | null | undefined,
): boolean {
  return !hasCvAttachment && (professionalSummary?.trim() ?? '') === '';
}
