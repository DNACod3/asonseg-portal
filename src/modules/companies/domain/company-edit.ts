/**
 * Regras puras da edição de Empresa (USP-015). Sem IO — a action carrega o
 * estado atual (`before`) e o payload validado (`after`) e delega a decisão de
 * rebaixamento da verificação a esta função (testável isoladamente).
 */

/** Subconjunto identitário de uma Empresa — base da decisão de rebaixamento (D-015-B). */
export interface CompanyIdentityFields {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
}

/**
 * A edição alterou algum campo **identitário** (`cnpj`, `razaoSocial` ou
 * `nomeFantasia`)?
 *
 * Verdadeiro **se e somente se** ao menos um dos três mudou (D-015-B / AC-015-2 /
 * ADR-0024). Quando verdadeiro, a action rebaixa `isVerified=false` na mesma
 * transação (P-001 / D-015-C). Mudanças em `type`, `setor`, `descricao` ou
 * `endereco` **não** afetam a verificação.
 *
 * Compara os valores já normalizados (o CNPJ chega sem máscara pelo Zod), então a
 * comparação é estrita por igualdade.
 */
export function identityFieldsChanged(
  before: CompanyIdentityFields,
  after: CompanyIdentityFields,
): boolean {
  return (
    before.cnpj !== after.cnpj ||
    before.razaoSocial !== after.razaoSocial ||
    before.nomeFantasia !== after.nomeFantasia
  );
}
