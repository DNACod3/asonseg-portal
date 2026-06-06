// Helpers de teste para os facts da USP-040 (a serem implementados no harness
// de integração do projeto — banco efêmero + container DI de teste).
//
// Declarados como stubs que LANÇAM "not implemented" para manter os testes
// VERMELHOS por design até o squad prover a infraestrutura real (TDD).

import type { ConsentPurpose } from '@/modules/consents'

const NI = (name: string): never => {
  throw new Error(`[USP-040 test helper] "${name}" não implementado — prover no harness`)
}

/** Cria um candidato (Person + CandidateProfile) no banco efêmero. Retorna personId. */
export async function seedCandidate(): Promise<string> {
  return NI('seedCandidate')
}

/** Concede consentimento ativo para a finalidade indicada. */
export async function grantConsent(_personId: string, _purpose: ConsentPurpose): Promise<void> {
  return NI('grantConsent')
}

/** Revoga (revokedAt = now) o consentimento da finalidade indicada. */
export async function revokeConsent(_personId: string, _purpose: ConsentPurpose): Promise<void> {
  return NI('revokeConsent')
}

/** Executa `fn` no contexto autenticado da Pessoa (popula getCurrentUser). */
export async function asUser<T>(_personId: string, _fn: () => Promise<T>): Promise<T> {
  return NI('asUser')
}

/** Gera um buffer de PDF sintético do tamanho pedido (com header %PDF válido). */
export function pdfFixture(_opts: { sizeMB: number }): Buffer {
  return NI('pdfFixture')
}
