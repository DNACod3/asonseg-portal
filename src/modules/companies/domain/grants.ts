/**
 * Regras puras do vínculo Pessoa↔Empresa (`PersonCompanyGrant`). Sem IO — a
 * action faz a contagem no banco e delega a decisão a estas funções (testáveis
 * isoladamente). USP-014.
 */

/**
 * A remoção deste grant deixaria a Empresa sem nenhum responsável ativo?
 *
 * Verdadeiro **se e somente se** `grantId` é o único responsável ATIVO da Empresa
 * — isto é, está em `activeGrantIds` e essa lista tem exatamente um elemento.
 * Se o grant alvo não está entre os ativos (ex.: é PENDING, ou já revogado),
 * removê-lo nunca afeta a invariante → falso.
 *
 * `activeGrantIds` deve conter apenas os grants `RESPONSIBLE` + `ACTIVE` +
 * `revokedAt=null` da Empresa (vínculos PENDING não contam — consistente com USP-013).
 */
export function wouldLeaveCompanyWithoutResponsible(
  activeGrantIds: string[],
  grantId: string,
): boolean {
  return activeGrantIds.length === 1 && activeGrantIds[0] === grantId;
}
