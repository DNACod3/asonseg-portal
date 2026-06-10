/**
 * Regras puras da máquina de estados de moderação (ADR-0011).
 *
 * Funções sem IO e sem `throw` — o coração do AC6. A função canônica
 * `transitionContent` (#122) e os testes unitários consomem estas funções para
 * decidir se uma transição é permitida e se exige justificativa.
 */

import {
  TRANSITIONS,
  type ContentKind,
  type ContentStatus,
  type TransitionRule,
  type TransitionTrigger,
} from './content-status';

/**
 * Retorna a regra de transição que casa `(from, to, trigger)` para o tipo de
 * conteúdo, ou `null` se a transição não está declarada na tabela. Não lança.
 */
export function findTransition(
  kind: ContentKind,
  from: ContentStatus,
  to: ContentStatus,
  trigger: TransitionTrigger,
): TransitionRule | null {
  const rules = TRANSITIONS[kind];
  if (!rules) return null;
  return rules.find((r) => r.from === from && r.to === to && r.trigger === trigger) ?? null;
}

/** `true` se a transição `(from, to, trigger)` é permitida para o tipo de conteúdo. */
export function isValidTransition(
  kind: ContentKind,
  from: ContentStatus,
  to: ContentStatus,
  trigger: TransitionTrigger,
): boolean {
  return findTransition(kind, from, to, trigger) !== null;
}

/**
 * `true` se a transição permitida exige motivo textual do operador
 * (devolver/rejeitar/inativar). Para transição inexistente retorna `false`
 * — a invalidez é detectada por {@link isValidTransition}, não aqui.
 */
export function requiresJustification(
  kind: ContentKind,
  from: ContentStatus,
  to: ContentStatus,
  trigger: TransitionTrigger,
): boolean {
  return findTransition(kind, from, to, trigger)?.requiresJustification ?? false;
}
