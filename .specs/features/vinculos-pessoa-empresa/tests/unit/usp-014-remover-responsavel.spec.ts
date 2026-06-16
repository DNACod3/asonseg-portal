// .specs/features/vinculos-pessoa-empresa/tests/unit/usp-014-remover-responsavel.spec.ts
// FACTS (red) — fonte da verdade da USP-014 (remoção append-only, D-014-A/B).
// Na fase Execute, mover/conectar para:
//   modules/companies/__tests__/grants.test.ts              (regra pura de invariante — T3)
//   modules/companies/__tests__/remove-responsible.schema.test.ts  (Zod — T4)
//   modules/companies/__tests__/remove-responsible.int.test.ts     (Server Action — T6)
//
// Cobertura dos casos obrigatórios de Server Action (project-guideline §12):
//   happy path · validação Zod · permissão (requirePermission) · pré-condição (invariante) · falha desacoplada.
// removerResponsavel: ator é responsável ATIVO (P-005); remoção marca revokedAt/revokedBy/revokeReason
//   (append-only, nunca delete — VPE-06); bloqueia o último ativo (VPE-05); e-mail no outbox não reverte.

import { describe, it, expect } from 'vitest'

// Stubs temporários — substituir pelos imports reais na fase Execute.
// import { removerResponsavel } from '@/modules/companies'
// import { wouldLeaveCompanyWithoutResponsible } from '@/modules/companies/domain/grants'
function removerResponsavel(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-014 (removerResponsavel)')
}
function wouldLeaveCompanyWithoutResponsible(_activeGrantIds: string[], _grantId: string): never {
  throw new Error('not implemented — fact red da USP-014 (wouldLeaveCompanyWithoutResponsible)')
}

describe('USP-014 — Remover responsável de uma Empresa (append-only)', () => {
  describe('wouldLeaveCompanyWithoutResponsible — regra pura (T3 / VPE-05)', () => {
    it('verdadeiro quando o grant alvo é o ÚNICO ativo', () => {
      expect(wouldLeaveCompanyWithoutResponsible(['g1'], 'g1')).toBe(true)
    })
    it('falso quando há ≥2 ativos', () => {
      expect(wouldLeaveCompanyWithoutResponsible(['g1', 'g2'], 'g1')).toBe(false)
    })
    it('falso quando o grant alvo não está entre os ativos', () => {
      expect(wouldLeaveCompanyWithoutResponsible(['g1', 'g2'], 'g3')).toBe(false)
    })
  })

  describe('removerResponsavel', () => {
    describe('AC-014-1 — happy path: encerra o vínculo (revokedAt) e notifica', () => {
      it('marca revokedAt/revokedBy, audita COMPANY_RESPONSIBLE_REMOVED e enfileira e-mail', async () => {
        const res = await removerResponsavel({ grantId: 'uuid-grant' })
        expect(res).toMatchObject({ ok: true })
        // E: grant.revokedAt != null, grant.revokedBy === ator (sem delete)
        // E: auditoria COMPANY_RESPONSIBLE_REMOVED + outbox "responsible-removed" na mesma transação
      })
    })

    describe('AC-014-1 — motivo opcional', () => {
      it('grava revokeReason quando o motivo é informado', async () => {
        const res = await removerResponsavel({ grantId: 'uuid-grant', motivo: 'Saiu da empresa' })
        expect(res).toMatchObject({ ok: true })
        // E: grant.revokeReason === 'Saiu da empresa'
      })
    })

    describe('AC-014-2 — invariante: bloqueia remover o último ativo', () => {
      it('retorna PRECONDITION_FAILED quando seria o último responsável ativo', async () => {
        const res = await removerResponsavel({ grantId: 'uuid-grant-unico' })
        expect(res).toMatchObject({ ok: false, error: { code: 'PRECONDITION_FAILED' } })
      })
    })

    describe('AC-014-1 — auto-remoção permitida com outro ativo', () => {
      it.todo('permite remover o próprio vínculo quando existe outro responsável ativo')
    })

    describe('Permissão — só responsável ATIVO', () => {
      it('nega quando o ator não é responsável ativo da Empresa do grant', async () => {
        const res = await removerResponsavel({ grantId: 'uuid-grant' })
        expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
      })
    })

    describe('Idempotência defensiva — vínculo inexistente/já removido', () => {
      it('retorna NOT_FOUND para grant inexistente ou já revogado', async () => {
        const res = await removerResponsavel({ grantId: 'uuid-inexistente' })
        expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
      })
    })

    describe('AC-014-3 / borda — falha de e-mail não reverte', () => {
      it.todo('persiste a remoção mesmo se o envio do e-mail falhar (outbox desacoplado)')
    })

    describe('Validação Zod', () => {
      it('rejeita grantId que não é UUID', async () => {
        const res = await removerResponsavel({ grantId: 'nao-uuid' })
        expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
      })
    })
  })
})
