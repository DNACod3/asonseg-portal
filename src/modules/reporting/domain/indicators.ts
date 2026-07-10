/**
 * Regra pura de exibição mínima da home pública (USP-041 / E-003 /
 * REL41-MN-02). Sem IO: recebe um número já agregado e decide se ele deve
 * ser exibido cru ou substituído por um placeholder ("Em breve" na UI).
 *
 * Política da diretoria (D-012/QP-004, RESOLVIDA): contadores abaixo de
 * `MINIMUM_DISPLAY_THRESHOLD` (=5) nunca aparecem como número — inclusive o
 * caso `0` (cold start / baseline). O limiar é tunável via parâmetro, mas o
 * padrão do produto é a constante exportada.
 */
export const MINIMUM_DISPLAY_THRESHOLD = 5;

export type IndicatorDisplay = { kind: 'value'; value: number } | { kind: 'placeholder' };

/**
 * Aplica a regra de exibição mínima: `n < threshold` ⇒ placeholder (a UI
 * renderiza "Em breve"); caso contrário, exibe o valor. Fronteira exata em
 * `threshold` (inclusive no lado "value").
 */
export function applyMinimumDisplay(
  n: number,
  threshold: number = MINIMUM_DISPLAY_THRESHOLD,
): IndicatorDisplay {
  return n < threshold ? { kind: 'placeholder' } : { kind: 'value', value: n };
}
