/**
 * Regras puras de exibição de candidato na busca ativa (USP-028).
 *
 * Sem IO — isolar aqui mantém a regra testável sem banco e reaproveitável pelo
 * View Model (`views/view-candidate-for-search.ts`).
 */

/**
 * Extrai o primeiro nome de um nome completo (1º token, separado por espaço).
 * `fullName` é PII (USP028-MN-02): este helper existe justamente para que o
 * View Model NUNCA precise emitir o nome completo — só o retorno desta função.
 *
 * - `''` (vazio/só espaços) → `''`.
 * - Único token → o próprio token.
 * - Espaços múltiplos entre tokens são ignorados (`split(/\s+/)`).
 * - Acentos são preservados (não há normalização — o token já vem como está).
 */
export function firstNameOf(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0] ?? '';
}
