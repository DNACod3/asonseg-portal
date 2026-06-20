import { Prisma } from '@prisma/client';

/**
 * Helpers de projeção compartilhados pelos View Models de vaga (lista e detalhe).
 *
 * Centraliza a **anonimização da Empresa** (ADR-0017/ADR-0022) numa fonte única — assim
 * lista (`viewJobForVisitor`) e detalhe (`viewJobDetail`) não divergem silenciosamente no
 * rótulo do anônimo. Ver runbook-view-model-visibility.
 */

/** Converte um `Decimal` do Prisma para `number` (ou `null`), na borda do View Model. */
export function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value == null ? null : value.toNumber();
}

/**
 * Nome de exibição da Empresa por papel — **única fonte** da anonimização (E-001/P-002):
 * anônimo recebe o rótulo por setor (`"Empresa do setor de X"`), o nome real **nunca** sai;
 * autenticado recebe o nome fantasia real (com fallback defensivo ao setor caso a query —
 * por least privilege — não o tenha carregado).
 */
export function companyDisplayName(
  company: { setor: string; nomeFantasia?: string | null },
  isAnonymized: boolean,
): string {
  if (isAnonymized) return `Empresa do setor de ${company.setor}`;
  return company.nomeFantasia ?? `Empresa do setor de ${company.setor}`;
}
