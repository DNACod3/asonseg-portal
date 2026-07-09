/**
 * View Model do contato do prestador revelado a um cliente com manifestação
 * ATIVA (USP-033 — AC-033-5 / SVC033-MN-01). "Prestador" = a Pessoa autora do
 * serviço (`Company` não tem campos de contato — só `endereco`); mesmo serviço
 * em nome de Empresa, o contato revelado é `author.phone`/`author.emailLogin`.
 * O nome de exibição já é público via `providerDisplayName` (USP-031) — aqui
 * repetido só para o bloco de contato ficar auto-contido.
 *
 * Único ponto de projeção do contato. A defesa real contra vazamento é o
 * `select` de `get-provider-contact.ts` (SVC033-MN-01 — o campo nem é carregado
 * para viewer sem interesse ativo), não este serializer.
 */

/** Shape mínimo que o serializer consome. */
export interface ProviderContactRow {
  displayName: string;
  phone: string | null;
  email: string | null;
}

export interface ProviderContact {
  displayName: string;
  phone: string | null;
  email: string | null;
}

export function viewProviderContactForClient(row: ProviderContactRow): ProviderContact {
  return {
    displayName: row.displayName,
    phone: row.phone,
    email: row.email,
  };
}
