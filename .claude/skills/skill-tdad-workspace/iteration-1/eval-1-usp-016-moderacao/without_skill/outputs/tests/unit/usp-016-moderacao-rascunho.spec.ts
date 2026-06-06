// tests/unit/usp-016-moderacao-rascunho.spec.ts
// FACTS (red) — fonte da verdade da USP-016 (Moderar rascunho de vaga, CV ou serviço).
// Mover para modules/moderation/__tests__/ na fase Execute, conectando à Server Action
// real `transitionContent` (ADR-0011 técnico) e às queries da fila de moderação.
//
// Cobertura dos casos obrigatórios de Server Action (project-guideline §12):
//   happy path · validação/justificativa · permissão recusada · concorrência.
// Consentimento LGPD (requireActiveConsent) NÃO se aplica: moderação é ato administrativo
// do coordenador sobre conteúdo de terceiro, não operação vinculada a finalidade do titular.
//
// Modelo de domínio (ADR-0011): ContentKind = JOB | CV | SERVICE.
//   IN_MODERATION --aprovar(MODERATOR_ACTION)--> ACTIVE
//   IN_MODERATION --devolver(MODERATOR_ACTION, requiresJustification)--> AWAITING_ADJUSTMENTS
//   IN_MODERATION --rejeitar(MODERATOR_ACTION, requiresJustification)--> REJECTED
// Eventos de auditoria: CONTENT_APPROVED · CONTENT_RETURNED · CONTENT_REJECTED.
// Permissões: MODERATE_JOB · MODERATE_CV · MODERATE_SERVICE (technical-design §117-119).

import { describe, it, expect } from 'vitest'

// Stubs temporários: substituir pelos imports reais na fase Execute.
// import { transitionContent } from '@/modules/moderation'
// import { listModerationQueue } from '@/modules/moderation'
function transitionContent(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-016 (transitionContent)')
}
function listModerationQueue(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-016 (listModerationQueue)')
}

describe('USP-016 — Moderar rascunho (vaga, CV ou serviço)', () => {
  // -----------------------------------------------------------------------
  // AC-016-1 — fila lista apenas IN_MODERATION ordenada por data de envio
  // -----------------------------------------------------------------------
  describe('AC-016-1 — fila de moderação', () => {
    it('lista somente conteúdo IN_MODERATION ordenado por data de envio (asc)', async () => {
      const res = await listModerationQueue({ kind: 'JOB' })
      // Esperado: apenas itens em IN_MODERATION; nenhum ACTIVE/DRAFT/etc.
      expect(res).toMatchObject({ ok: true })
      // E: todos os itens com status IN_MODERATION
      // E: ordenados por submittedAt crescente (mais antigo primeiro)
    })

    it.todo('não inclui na fila conteúdo em DRAFT, ACTIVE, AWAITING_ADJUSTMENTS, REJECTED')
    it.todo('pagina a fila com take obrigatório (project-guideline — sem query sem take)')
  })

  // -----------------------------------------------------------------------
  // AC-016-2 — aprovar → ACTIVE + e-mail + auditoria + revalidation
  // -----------------------------------------------------------------------
  describe('AC-016-2 — aprovar', () => {
    it('transita IN_MODERATION → ACTIVE, audita CONTENT_APPROVED e notifica autor', async () => {
      const res = await transitionContent({
        contentKind: 'JOB',
        contentId: 'job-1',
        to: 'ACTIVE',
        trigger: 'MODERATOR_ACTION',
      })
      expect(res).toMatchObject({ ok: true, data: { from: 'IN_MODERATION', to: 'ACTIVE' } })
      // E: evento de auditoria CONTENT_APPROVED registrado
      // E: e-mail "vaga aprovada" enviado ao autor
      // E: revalidatePath das rotas públicas afetadas
    })

    it('recusa aprovar a partir de estado não-moderável (INVALID_TRANSITION)', async () => {
      const res = await transitionContent({
        contentKind: 'JOB',
        contentId: 'job-ativo',
        to: 'ACTIVE',
        trigger: 'MODERATOR_ACTION',
      })
      expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } })
    })
  })

  // -----------------------------------------------------------------------
  // AC-016-3 — devolver para ajustes (motivo obrigatório) → AWAITING_ADJUSTMENTS
  // -----------------------------------------------------------------------
  describe('AC-016-3 — devolver para ajustes', () => {
    it('com motivo: transita IN_MODERATION → AWAITING_ADJUSTMENTS e e-mail leva o motivo', async () => {
      const res = await transitionContent({
        contentKind: 'CV',
        contentId: 'cv-1',
        to: 'AWAITING_ADJUSTMENTS',
        trigger: 'MODERATOR_ACTION',
        justification: 'Foto ilegível, reenviar',
      })
      expect(res).toMatchObject({
        ok: true,
        data: { from: 'IN_MODERATION', to: 'AWAITING_ADJUSTMENTS' },
      })
      // E: e-mail ao autor contendo o motivo
      // E: auditoria CONTENT_RETURNED com justification
    })

    it('sem motivo: bloqueia com JUSTIFICATION_REQUIRED e mantém o status', async () => {
      const res = await transitionContent({
        contentKind: 'CV',
        contentId: 'cv-1',
        to: 'AWAITING_ADJUSTMENTS',
        trigger: 'MODERATOR_ACTION',
        justification: '',
      })
      expect(res).toMatchObject({ ok: false, error: { code: 'JUSTIFICATION_REQUIRED' } })
    })

    it('motivo só com espaços em branco também é rejeitado (trim)', async () => {
      const res = await transitionContent({
        contentKind: 'CV',
        contentId: 'cv-1',
        to: 'AWAITING_ADJUSTMENTS',
        trigger: 'MODERATOR_ACTION',
        justification: '   ',
      })
      expect(res).toMatchObject({ ok: false, error: { code: 'JUSTIFICATION_REQUIRED' } })
    })
  })

  // -----------------------------------------------------------------------
  // AC-016-4 — rejeitar definitivamente (motivo obrigatório) → REJECTED
  // -----------------------------------------------------------------------
  describe('AC-016-4 — rejeitar definitivamente', () => {
    it('com motivo: transita IN_MODERATION → REJECTED, audita CONTENT_REJECTED e e-mail', async () => {
      const res = await transitionContent({
        contentKind: 'SERVICE',
        contentId: 'svc-1',
        to: 'REJECTED',
        trigger: 'MODERATOR_ACTION',
        justification: 'Conteúdo viola diretrizes',
      })
      expect(res).toMatchObject({ ok: true, data: { from: 'IN_MODERATION', to: 'REJECTED' } })
    })

    it('sem motivo: bloqueia com JUSTIFICATION_REQUIRED', async () => {
      const res = await transitionContent({
        contentKind: 'SERVICE',
        contentId: 'svc-1',
        to: 'REJECTED',
        trigger: 'MODERATOR_ACTION',
      })
      expect(res).toMatchObject({ ok: false, error: { code: 'JUSTIFICATION_REQUIRED' } })
    })
  })

  // -----------------------------------------------------------------------
  // AC-016-5 — log da decisão (autor/decisor, momento, motivo) — transversal
  // -----------------------------------------------------------------------
  describe('AC-016-5 — auditoria da decisão', () => {
    it.each([
      ['ACTIVE', 'CONTENT_APPROVED', undefined],
      ['AWAITING_ADJUSTMENTS', 'CONTENT_RETURNED', 'Foto ilegível'],
      ['REJECTED', 'CONTENT_REJECTED', 'Viola diretrizes'],
    ] as const)(
      'transição para %s registra %s com decisor, timestamp e motivo',
      async (to, _evento, justification) => {
        const res = await transitionContent({
          contentKind: 'JOB',
          contentId: 'job-1',
          to,
          trigger: 'MODERATOR_ACTION',
          justification,
        })
        // O audit_log é append-only (ADR-T-0004): a transição deve gravar
        // entry com { eventType, actorId (decisor), createdAt, justification? }.
        expect(res).toMatchObject({ ok: true })
      },
    )
    it.todo('audit_log é append-only: decisão registrada não pode ser UPDATE/DELETE')
  })

  // -----------------------------------------------------------------------
  // Casos obrigatórios de Server Action sensível (project-guideline §12)
  // -----------------------------------------------------------------------
  describe('AC-016-2/3/4 — permissão recusada', () => {
    it('usuário sem MODERATE_<KIND> recebe FORBIDDEN e status não muda', async () => {
      // Contexto: ator autenticado sem a permissão de moderar o tipo.
      const res = await transitionContent({
        contentKind: 'JOB',
        contentId: 'job-1',
        to: 'ACTIVE',
        trigger: 'MODERATOR_ACTION',
      })
      expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
    })
    it.todo('voluntário com permissão delegada de moderação consegue decidir (mesmo fluxo)')
  })

  describe('AC-016-2 — concorrência (dois moderadores)', () => {
    // Mitigação ADR-0011: UPDATE com WHERE status = current (otimista);
    // a segunda chamada falha por INVALID_TRANSITION.
    it.todo('duas aprovações simultâneas: só uma aplica; a outra falha INVALID_TRANSITION')
    it.todo('apenas um evento CONTENT_APPROVED é registrado na corrida')
  })
})
