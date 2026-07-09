import { Prisma } from '@prisma/client';

/**
 * Helpers de projeção compartilhados pelos View Models de serviço (lista e
 * detalhe). Espelha `jobs/views/company-display.ts` — mas **sem** anonimização:
 * o nome do prestador/Empresa é público a todos (ADR-0010, diferença chave vs
 * vagas). A barreira de privacidade em Serviços é só o **contato** (telefone/
 * e-mail), nunca o nome — ver `service-detail.view.ts` (USP-031).
 */

/** Converte um `Decimal` do Prisma para `number` (ou `null`), na borda do View Model. */
export function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value == null ? null : value.toNumber();
}

/**
 * Nome de exibição do prestador: `company.nomeFantasia` quando publicado em
 * nome de uma Empresa (`companyId` setado), senão `author.fullName` (PF).
 * Público a todos — não há branch de anonimização (diferença vs `jobs`).
 */
export function providerDisplayName(row: {
  company: { nomeFantasia: string } | null;
  author: { fullName: string };
}): string {
  return row.company?.nomeFantasia ?? row.author.fullName;
}
