/**
 * Regra pura de autorização de papel para abrir o painel consolidado da Pessoa
 * (USP-039 / SOC-06, SOC-039-MN-02).
 *
 * Sem IO — apenas a política de acesso ao painel. Isolar aqui mantém a regra
 * testável sem banco e reaproveitável pelo assembler (`view-person-for-social-
 * assistant.ts`) e pelo gate da rota `(app)/pessoas/[id]/visao-consolidada`.
 *
 * Nota: esta guarda decide **acesso ao painel** (AS/BOARD/COORDINATOR). A ficha
 * socioeconômica dentro do painel permanece gated à parte por
 * `canManageSocioeconomicRecord` (AS/BOARD apenas) — um coordenador passa por
 * esta guarda mas não pela da ficha (SOC-039-MN-01).
 */

/**
 * Papéis institucionais autorizados a abrir a visão consolidada de uma Pessoa
 * (Assumption #1 da spec — espelha `ACCESS_REPORT_ROLES` do precedente
 * `reporting/actions/access-report.ts`, mesmo "painel consolidado de Pessoa").
 */
export const CONSOLIDATED_PERSON_ROLES = ['SOCIAL_ASSISTANT', 'BOARD', 'COORDINATOR'] as const;

export type ConsolidatedPersonRole = (typeof CONSOLIDATED_PERSON_ROLES)[number];

/**
 * `true` se algum papel ATIVO do ator autoriza abrir o painel consolidado de
 * qualquer Pessoa (SOC-039-MN-02: nenhum outro papel — incluindo `VOLUNTEER`
 * sem papel adicional — passa por aqui).
 */
export function canViewConsolidatedPerson(roles: readonly string[]): boolean {
  const allowed: readonly string[] = CONSOLIDATED_PERSON_ROLES;
  return roles.some((role) => allowed.includes(role));
}
