// .specs/features/moderar-rascunho/tests/unit/usp-016-maquina-estados.property.spec.ts
// FACT (red) — property-based test da máquina de estados de moderação (USP-016).
// Mover para modules/moderation/__tests__/properties/ na fase Execute.
//
// Fonte: project-guideline §12 (property-based recomendado para a máquina de estados —
//        "nenhuma sequência de transições válidas resulta em status inválido")
//        ADR-T-0011 (TRANSITIONS por ContentKind, trigger, requiresJustification).
//
// Cobre o aspecto invariante de AC-016-2/3/4: a função canônica transitionContent só aplica
// transições que existam na tabela TRANSITIONS[kind] e exige justificativa quando configurado.

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// Stubs temporários: substituir pelos imports reais na fase Execute.
// import { ContentStatus, ContentKind, TRANSITIONS, isValidTransition } from '@/modules/moderation'
function notImplemented(): never {
  throw new Error('not implemented — fact red da USP-016 (property)')
}
const isValidTransition = (_kind: string, _from: string, _to: string, _trigger: string): never => notImplemented()

const STATUSES = [
  'DRAFT', 'IN_MODERATION', 'AWAITING_ADJUSTMENTS', 'ACTIVE',
  'REJECTED', 'PAUSED', 'EXPIRED', 'ARCHIVED', 'INACTIVATED',
] as const
const KINDS = ['JOB', 'CV', 'SERVICE'] as const

describe('USP-016 — invariantes da máquina de estados de moderação (AC-016-2/3/4)', () => {
  it.todo('toda transição resultante de transitionContent é membro de TRANSITIONS[kind] (nenhuma transição fora da tabela é aceita)')

  it.todo('nenhuma sequência de transições válidas leva a um status fora do enum ContentStatus')

  it('rejeita qualquer (from,to,trigger) ausente da tabela como transição inválida', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...KINDS),
        fc.constantFrom(...STATUSES),
        fc.constantFrom(...STATUSES),
        fc.constantFrom('AUTHOR_ACTION', 'MODERATOR_ACTION', 'SYSTEM_JOB', 'COORDINATOR_INACTIVATION'),
        (kind, from, to, trigger) => {
          // Invariante: isValidTransition é verdadeiro SOMENTE quando o trio existe na tabela.
          // Red: o stub lança not-implemented; na fase Execute, asserir contra TRANSITIONS real.
          const valid = isValidTransition(kind, from, to, trigger)
          expect(typeof valid).toBe('boolean')
        },
      ),
    )
  })

  it.todo('transições MODERATOR_ACTION para AWAITING_ADJUSTMENTS e REJECTED têm requiresJustification = true')
  it.todo('transição MODERATOR_ACTION para ACTIVE (aprovar) tem requiresJustification = false')
})
