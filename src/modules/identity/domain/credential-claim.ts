/**
 * Regras puras da reivindicação de credencial de Pessoa pré-cadastrada (USP-003).
 *
 * Sem IO — apenas a política de autorização institucional de quem pode confirmar
 * a verificação de identidade e ativar a credencial. Isolar aqui mantém a regra
 * testável sem banco e reaproveitável pela Server Action e pelo gate da rota
 * `(app)/credenciais/reivindicacoes`.
 */

/**
 * Papéis institucionais autorizados a aprovar uma reivindicação de credencial —
 * o item 9 do catálogo do Portal, "aprovar reivindicação de credencial"
 * (E-002 / P-005). Enquanto o RBAC delegado da USP-008 não existe, esta lista é
 * a fonte de verdade da permissão deste fluxo (mesmo padrão de
 * `ASSISTED_REGISTRATION_ROLES`). Inclui COORDINATOR, que opera a fila de
 * verificação (intent §4 / D-004).
 */
export const CREDENTIAL_CLAIM_APPROVER_ROLES = [
  'SOCIAL_ASSISTANT',
  'BOARD',
  'COORDINATOR',
] as const;

export type CredentialClaimApproverRole = (typeof CREDENTIAL_CLAIM_APPROVER_ROLES)[number];

/**
 * `true` se algum dos papéis ATIVOS da Pessoa autoriza aprovar reivindicações.
 * Recebe os papéis ativos resolvidos em `getCurrentPerson()` (ADR-0030). Negar
 * por delegação implícita ou rota alternativa é responsabilidade do caller (P-005).
 */
export function canApproveCredentialClaim(roles: readonly string[]): boolean {
  const allowed: readonly string[] = CREDENTIAL_CLAIM_APPROVER_ROLES;
  return roles.some((role) => allowed.includes(role));
}
