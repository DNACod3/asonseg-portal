/**
 * Calculadora pura de MP10 (design.md §5) — tempo médio de moderação
 * (envio → 1ª decisão do coordenador), a partir de pares já extraídos do
 * `audit_log` pela query (`report-moderation-queue.ts`). Sem IO.
 */

/** Um par submit→decisão de um conteúdo moderável. */
export interface ModerationPair {
  submittedAt: Date;
  /** `null` = ainda sem decisão (permanece na fila) — ignorado no cálculo. */
  decidedAt: Date | null;
}

const MS_PER_HOUR = 3_600_000;

/**
 * Média, em horas, de `decidedAt - submittedAt` sobre os pares **com**
 * decisão. Pares sem decisão (`decidedAt = null`) são ignorados — ainda
 * estão na fila, não têm duração de moderação para contar. Lista vazia OU
 * só com pares sem decisão ⇒ `null` (nada para medir, não `0`).
 */
export function moderationAvgHours(pairs: readonly ModerationPair[]): number | null {
  const withDecision = pairs.filter(
    (pair): pair is { submittedAt: Date; decidedAt: Date } => pair.decidedAt !== null,
  );
  if (withDecision.length === 0) return null;

  const totalHours = withDecision.reduce(
    (sum, pair) => sum + (pair.decidedAt.getTime() - pair.submittedAt.getTime()) / MS_PER_HOUR,
    0,
  );
  return totalHours / withDecision.length;
}
