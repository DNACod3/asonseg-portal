// .specs/features/vinculos-pessoa-empresa/tests/unit/usp-013-adicionar-responsavel.spec.ts
// FACTS (red) — fonte da verdade da USP-013 (modelo PENDENTE+ACEITE, AD-006).
// Na fase Execute, mover/conectar para:
//   modules/companies/__tests__/add-responsible.int.test.ts
//   modules/companies/__tests__/accept-responsible-link.int.test.ts
//
// Cobertura dos casos obrigatórios de Server Action (project-guideline §12):
//   happy path · validação Zod · permissão (requirePermission) · consentimento · concorrência.
// adicionarResponsavel: ator é responsável ATIVO (P-005); consent finalidade 5 NÃO é exigido do
//   ator aqui (ele já é responsável) — é CAPTURADO no aceite da Pessoa adicionada (P-003).
// aceitarVinculoResponsavel: a própria Pessoa do vínculo; ativa papel + consent na mesma tx.

import { describe, it, expect } from 'vitest'

// Stubs temporários — substituir pelos imports reais na fase Execute.
// import { adicionarResponsavel, aceitarVinculoResponsavel } from '@/modules/companies'
function adicionarResponsavel(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-013 (adicionarResponsavel)')
}
function aceitarVinculoResponsavel(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-013 (aceitarVinculoResponsavel)')
}

describe('USP-013 — Adicionar responsável a uma Empresa (pendente+aceite)', () => {
  describe('adicionarResponsavel', () => {
    describe('E-001 / P-002 — happy path: cria vínculo PENDING', () => {
      it('cria PersonCompanyGrant RESPONSIBLE com status PENDING e audita COMPANY_RESPONSIBLE_ADDED', async () => {
        const input = { empresaId: 'uuid-empresa', cpfOuEmail: '39053344705' }
        const res = await adicionarResponsavel(input)
        expect(res).toMatchObject({ ok: true })
        // E: grant.status === 'PENDING', grant.grantType === 'RESPONSIBLE'
        // E: evento de auditoria COMPANY_RESPONSIBLE_ADDED na mesma transação
      })
    })

    describe('P-001 — busca binária sem PII', () => {
      it('retorna apenas presença (encontrada/não), sem nome/foto antes da confirmação', async () => {
        const res = await adicionarResponsavel({ empresaId: 'uuid-empresa', cpfOuEmail: '39053344705' })
        // O retorno da fase de busca não pode conter PII da Pessoa-alvo.
        expect(res).not.toHaveProperty('data.nome')
        expect(res).not.toHaveProperty('data.pessoa.nome')
      })
    })

    describe('E-002 — Pessoa não cadastrada bloqueia e orienta auto-cadastro', () => {
      it('retorna erro NOT_FOUND orientando auto-cadastro, sem disparar convite', async () => {
        const res = await adicionarResponsavel({ empresaId: 'uuid-empresa', cpfOuEmail: 'naoexiste@x.com' })
        expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
      })
    })

    describe('E-003 — e-mail de aceite enfileirado no outbox', () => {
      it.todo('enfileira outbox "responsible-link-pending" com link de aceite ao criar o vínculo PENDING')
    })

    describe('P-005 — permissão: só responsável ATIVO', () => {
      it('nega quando o ator não é responsável ativo da Empresa', async () => {
        const res = await adicionarResponsavel({ empresaId: 'uuid-empresa', cpfOuEmail: '39053344705' })
        expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
      })
    })

    describe('P-004 — unicidade sob concorrência (UNIQUE parcial + 409)', () => {
      it('bloqueia duplicidade de vínculo PENDING/ACTIVE com CONFLICT', async () => {
        const res = await adicionarResponsavel({ empresaId: 'uuid-empresa', cpfOuEmail: '39053344705' })
        expect(res).toMatchObject({ ok: false, error: { code: 'CONFLICT' } })
      })
      it.todo('duas adições simultâneas da mesma Pessoa → um único vínculo + 409 determinístico no 2º')
    })

    describe('L-002 — rate limit anti-enumeração', () => {
      it.todo('recusa buscas além do limite por identidade/janela, sem revelar PII')
    })

    describe('Validação Zod', () => {
      it('rejeita identificador que não é CPF nem e-mail válido', async () => {
        const res = await adicionarResponsavel({ empresaId: 'uuid-empresa', cpfOuEmail: '???' })
        expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
      })
    })
  })

  describe('aceitarVinculoResponsavel', () => {
    describe('P-002 / E-003 — happy path: PENDING → ACTIVE', () => {
      it('torna o vínculo ACTIVE, preenche acceptedAt e audita COMPANY_RESPONSIBLE_LINK_ACCEPTED', async () => {
        const res = await aceitarVinculoResponsavel({ empresaId: 'uuid-empresa' })
        expect(res).toMatchObject({ ok: true })
        // E: grant.status === 'ACTIVE', grant.acceptedAt != null
      })
    })

    describe('P-003 / E-001 — atomicidade papel + consentimento', () => {
      it('ativa papel COMPANY_RESPONSIBLE e captura consent finalidade 5 na mesma transação', async () => {
        const res = await aceitarVinculoResponsavel({ empresaId: 'uuid-empresa' })
        expect(res).toMatchObject({ ok: true })
        // E: papel COMPANY_RESPONSIBLE ativo na Pessoa
        // E: consent finalidade 5 (representação de Empresa) gravado
      })
    })

    describe('P-002 — idempotência: vínculo não-PENDING', () => {
      it('bloqueia aceite quando não há vínculo PENDING (já aceito/removido/inexistente)', async () => {
        const res = await aceitarVinculoResponsavel({ empresaId: 'uuid-empresa' })
        expect(res).toMatchObject({ ok: false })
      })
    })

    describe('P-002 — permissão: só a própria Pessoa do vínculo', () => {
      it('nega quando o ator autenticado não é a Pessoa do vínculo PENDING', async () => {
        const res = await aceitarVinculoResponsavel({ empresaId: 'uuid-empresa' })
        expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
      })
    })

    describe('Validação Zod', () => {
      it('rejeita empresaId que não é UUID', async () => {
        const res = await aceitarVinculoResponsavel({ empresaId: 'nao-uuid' })
        expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
      })
    })
  })
})
