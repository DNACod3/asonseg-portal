import type { CompanyGrantStatus } from '@prisma/client';

/**
 * Rótulos PT-BR de `CompanyGrantStatus` (USP-059 — SOC-4). Consumido pelo
 * painel consolidado da Pessoa (`persons` / T9) para não exibir os tokens
 * crus `PENDING`/`ACTIVE` a operadores institucionais.
 */
export const COMPANY_GRANT_STATUS_LABELS: Record<CompanyGrantStatus, string> = {
  PENDING: 'Pendente',
  ACTIVE: 'Ativo',
};
