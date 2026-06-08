/**
 * Porta da verificação de "único responsável de Empresa" para a inativação de
 * Pessoa (USP-007 / AC-007-3 / E-003 / P-002 — ADR-0014).
 *
 * O módulo `persons` **define** de que precisa (Dependency Inversion); o módulo
 * `companies` (a ser criado em USP-010..014) **fornece** o adapter concreto. Até
 * lá vale o {@link NullCompanyResponsibilityAdapter}. Consumidores resolvem a
 * implementação por `container.resolve(COMPANY_RESPONSIBILITY_TOKEN)` — nunca
 * importam o adapter direto.
 */

/** Referência mínima a uma Empresa que ficaria órfã (sem PII). */
export interface OrphanedCompanyRef {
  id: string;
  /** Nome/razão social — usado na mensagem que instrui a designar novo responsável. */
  name: string;
}

export interface CompanyResponsibilityPort {
  /**
   * Empresas que ficariam **sem responsável ativo** se a Pessoa fosse inativada
   * — i.e., aquelas em que ela é o **único** responsável ativo (AC-007-3).
   * Lista vazia ⇒ a inativação não viola o invariante de Empresa (P-002).
   */
  companiesLeftWithoutResponsible(personId: string): Promise<OrphanedCompanyRef[]>;
}

import { createToken } from '@/shared/container';

export const COMPANY_RESPONSIBILITY_TOKEN = createToken<CompanyResponsibilityPort>(
  'persons.CompanyResponsibility',
);
