/**
 * Regra pura de motivo significativo para decisões de moderação (P-003).
 *
 * Fonte única reusada pela máquina (`transitionContent`, #122 — defesa em
 * profundidade) e pelo schema Zod das actions (#123). Devolver/rejeitar/inativar
 * exigem ≥ 20 caracteres descritivos — bloqueia vazio, caractere único,
 * espaços/traços e genéricos ("x", "—", "ok").
 */

/** Mínimo de caracteres significativos exigido em devolver/rejeitar/inativar (P-003). */
export const MIN_JUSTIFICATION_LENGTH = 20;

/**
 * Mínimo de letras distintas (case-insensitive, acento normalizado) exigido
 * para considerar o motivo significativo (USP-056 MOD-6). Barra mashes de
 * caractere repetido/alfabeto curto ("aaaa…", "abababab…") sem barrar motivos
 * PT-BR reais, que tipicamente têm bem mais de 5 letras distintas.
 */
export const MIN_DISTINCT_LETTERS = 5;

/** Mensagem PT-BR padrão para motivo insuficiente (reusada no schema e na UI). */
export const JUSTIFICATION_TOO_SHORT_MESSAGE =
  `O motivo deve ter ao menos ${MIN_JUSTIFICATION_LENGTH} caracteres descritivos.`;

/** Mensagem PT-BR para motivo sem conteúdo significativo (só pontuação/genérico). */
export const JUSTIFICATION_NOT_MEANINGFUL_MESSAGE =
  'Descreva o motivo de forma significativa para o autor.';

// Apenas espaços, traços, pontos ou repetição de "x" — sem informação para o autor.
const NON_MEANINGFUL = /^[\s\-—.xX]+$/;

/**
 * `true` se o motivo é significativo: ≥ {@link MIN_JUSTIFICATION_LENGTH}
 * caracteres após `trim` e não composto apenas de pontuação/genéricos.
 * Não lança — para compor com a sequência canônica de Server Action.
 */
export function isMeaningfulJustification(text: string | null | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < MIN_JUSTIFICATION_LENGTH) return false;
  if (NON_MEANINGFUL.test(trimmed)) return false;
  const distinctLetters = new Set(
    trimmed.toLowerCase().normalize('NFD').replace(/[^a-z]/g, ''),
  );
  if (distinctLetters.size < MIN_DISTINCT_LETTERS) return false;
  return true;
}
