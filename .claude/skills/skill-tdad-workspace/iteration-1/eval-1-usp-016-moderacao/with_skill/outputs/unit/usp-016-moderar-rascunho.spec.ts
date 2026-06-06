// .specs/features/moderar-rascunho/tests/unit/usp-016-moderar-rascunho.spec.ts
// FACTS (red) — fonte da verdade da USP-016 (Moderar rascunho de vaga, CV ou serviço).
// Mover para modules/moderation/__tests__/ na fase Execute, conectando às Server Actions reais.
//
// Fonte: PRD USP-016 (AC-016-1..5) · ADR-T-0011 (transitionContent / TRANSITIONS / requiresJustification)
//        ADR-T-0004 (audit append-only) · technical-design §3.3 · enum PermissionId
//        project-guideline §4 (Server Action), §6 (máquina de estados), §12 (casos obrigatórios).
//
// Casos obrigatórios de Server Action sensível (project-guideline §12) e como se aplicam aqui:
//   happy path .......... aprovar / devolver / rejeitar (AC-016-2/3/4)
//   validação Zod ....... motivo obrigatório em devolver/rejeitar (AC-016-3/4 -> JUSTIFICATION_REQUIRED)
//   permissão recusada .. requirePermission MODERATE_<KIND> (AC-016-1/2/3/4)
//   consentimento ....... NÃO se aplica — moderação é ação administrativa, não vinculada a finalidade LGPD do moderador (justificado)
//   concorrência ........ aprovação dupla do mesmo conteúdo (AC-016-2, risco 3 do ADR-T-0011)

import { describe, it, expect } from 'vitest'

// Stubs temporários: substituir pelos imports reais na fase Execute.
// import { listModerationQueue } from '@/modules/moderation'         // AC-016-1
// import { approveContent, returnContentForAdjustments, rejectContent } from '@/modules/moderation' // AC-016-2/3/4
// import { transitionContent } from '@/modules/moderation'
function notImplemented(): never {
  throw new Error('not implemented — fact red da USP-016')
}
const listModerationQueue = (_input?: unknown): never => notImplemented()
const approveContent = (_input: unknown): never => notImplemented()
const returnContentForAdjustments = (_input: unknown): never => notImplemented()
const rejectContent = (_input: unknown): never => notImplemented()

describe('USP-016 — Moderar rascunho de vaga, CV ou serviço', () => {
  // ──────────────────────────────────────────────────────────────────────────
  describe('AC-016-1 — fila de moderação (listagem ordenada por data de envio)', () => {
    it('lista apenas conteúdos IN_MODERATION ordenados por data de envio', async () => {
      const res = await listModerationQueue({ contentKind: 'JOB' })
      expect(res).toMatchObject({ ok: true })
      // E: res.data.every(item => item.status === 'IN_MODERATION')
      // E: res.data está ordenado ascendente por submittedAt (data de envio para moderação)
    })

    it('recusa acesso à fila quando falta permissão de moderação', async () => {
      // Contexto: usuário sem MODERATE_JOB / MODERATE_CV / MODERATE_SERVICE
      const res = await listModerationQueue({ contentKind: 'JOB' })
      expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  describe('AC-016-2 — aprovar (IN_MODERATION -> ACTIVE, sem justificativa)', () => {
    it('aprova: muda status para ACTIVE, envia e-mail ao autor e audita CONTENT_APPROVED', async () => {
      const res = await approveContent({
        contentKind: 'JOB',
        contentId: 'job-uuid',
        // trigger interno: MODERATOR_ACTION; requiresJustification = false
      })
      expect(res).toMatchObject({ ok: true, data: { from: 'IN_MODERATION', to: 'ACTIVE' } })
      // E: side effect e-mail "aprovado" ao autor
      // E: audit_log recebe CONTENT_APPROVED (entity_type/entity_id corretos)
    })

    it('recusa aprovação quando falta permissão MODERATE_<KIND>', async () => {
      const res = await approveContent({ contentKind: 'CV', contentId: 'cv-uuid' })
      expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
    })

    it('rejeita aprovar conteúdo que não está em moderação (transição inválida)', async () => {
      const res = await approveContent({ contentKind: 'JOB', contentId: 'job-ja-ativo' })
      expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } })
    })

    // Concorrência (ADR-T-0011, Risco 3): UPDATE com WHERE status = current (otimista).
    it.todo('aprovação dupla concorrente do mesmo conteúdo: só a 1ª aplica, a 2ª retorna INVALID_TRANSITION')
  })

  // ──────────────────────────────────────────────────────────────────────────
  describe('AC-016-3 — devolver para ajustes (IN_MODERATION -> AWAITING_ADJUSTMENTS, motivo obrigatório)', () => {
    it('devolve com motivo: muda para AWAITING_ADJUSTMENTS, envia e-mail com o motivo e audita', async () => {
      const res = await returnContentForAdjustments({
        contentKind: 'SERVICE',
        contentId: 'svc-uuid',
        justification: 'Faltam dados de contato',
      })
      expect(res).toMatchObject({ ok: true, data: { from: 'IN_MODERATION', to: 'AWAITING_ADJUSTMENTS' } })
      // E: e-mail ao autor inclui o motivo
      // E: audit CONTENT_RETURNED_FOR_ADJUSTMENTS com o motivo
    })

    it.each([
      [undefined],
      [''],
      ['   '],
    ])('bloqueia devolução sem motivo válido (%p) com JUSTIFICATION_REQUIRED', async (justification) => {
      const res = await returnContentForAdjustments({
        contentKind: 'JOB',
        contentId: 'job-uuid',
        justification,
      })
      expect(res).toMatchObject({ ok: false, error: { code: 'JUSTIFICATION_REQUIRED' } })
      // E: status permanece IN_MODERATION; nenhum e-mail enviado
    })

    it('recusa devolução quando falta permissão de moderação', async () => {
      const res = await returnContentForAdjustments({ contentKind: 'JOB', contentId: 'x', justification: 'motivo' })
      expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  describe('AC-016-4 — rejeitar definitivamente (IN_MODERATION -> REJECTED, motivo obrigatório)', () => {
    it('rejeita com motivo: muda para REJECTED, envia e-mail ao autor e audita CONTENT_REJECTED', async () => {
      const res = await rejectContent({
        contentKind: 'CV',
        contentId: 'cv-uuid',
        justification: 'Conteúdo fora de escopo',
      })
      expect(res).toMatchObject({ ok: true, data: { from: 'IN_MODERATION', to: 'REJECTED' } })
      // E: e-mail ao autor
      // E: audit CONTENT_REJECTED com o motivo
    })

    it.each([
      [undefined],
      [''],
      ['   '],
    ])('bloqueia rejeição sem motivo válido (%p) com JUSTIFICATION_REQUIRED', async (justification) => {
      const res = await rejectContent({ contentKind: 'JOB', contentId: 'job-uuid', justification })
      expect(res).toMatchObject({ ok: false, error: { code: 'JUSTIFICATION_REQUIRED' } })
    })

    it('recusa rejeição quando falta permissão de moderação', async () => {
      const res = await rejectContent({ contentKind: 'JOB', contentId: 'x', justification: 'motivo' })
      expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  describe('AC-016-5 — registro de decisão (autor, momento, motivo) — auditoria', () => {
    it.todo('CONTENT_APPROVED registra autor (moderador) e timestamp')
    it.todo('CONTENT_RETURNED_FOR_ADJUSTMENTS registra autor, timestamp e motivo')
    it.todo('CONTENT_REJECTED registra autor, timestamp e motivo')
    // ADR-T-0004: audit_log é append-only (REVOKE UPDATE/DELETE no banco).
    it.todo('log de decisão de moderação não pode ser alterado nem removido (append-only)')
  })
})
