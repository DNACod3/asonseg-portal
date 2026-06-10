// .specs/features/moderacao-conteudo/usp-016-moderar-rascunho/tests/unit/usp-016-moderar-rascunho.spec.ts
// FACTS (red) — fonte da verdade da USP-016 (Moderar rascunho, #117).
// Na fase Execute, mover/conectar para:
//   - regras puras (máquina de estados) → src/modules/moderation/domain/{content-status,transition-rules}.ts   (#121)
//   - transitionContent (integração)    → src/modules/moderation/__tests__/transition-content.int.test.ts        (#122)
//   - actions de decisão (integração)   → src/modules/moderation/__tests__/decide.int.test.ts                    (#123)
//   - query da fila / schema motivo      → src/modules/moderation/{queries,schemas}/                              (#123)
//
// Casos obrigatórios de Server Action (project-guideline §12):
//   happy path · validação Zod · permissão recusada · concorrência. (Consentimento não se aplica à decisão de moderação.)
//
// REGRA red: falha por falta de implementação, nunca por import quebrado.

import { describe, it, expect } from 'vitest';

// Stubs temporários — substituir pelos imports reais na fase Execute.
// import { isValidTransition, requiresJustification, TRANSITIONS, ContentKind, ContentStatus } from '@/modules/moderation';
// import { transitionContent } from '@/modules/moderation';
// import { approveContent, returnForAdjustments, rejectContent } from '@/modules/moderation';
// import { viewModerationQueue } from '@/modules/moderation';
// import { returnForAdjustmentsSchema } from '@/modules/moderation';

function isValidTransition(_kind: string, _from: string, _to: string, _trigger: string): never {
  throw new Error('not implemented — fact red da USP-016 (#121)');
}
function requiresJustification(_kind: string, _from: string, _to: string, _trigger: string): never {
  throw new Error('not implemented — fact red da USP-016 (#121)');
}
function transitionContent(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-016 (#122)');
}
function approveContent(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-016 (#123)');
}
function returnForAdjustments(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-016 (#123)');
}
function rejectContent(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-016 (#123)');
}
function viewModerationQueue(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-016 (#123)');
}

const JOB = 'JOB';
const CONTENT = { contentKind: JOB, contentId: '00000000-0000-0000-0000-000000000010' };

describe('USP-016 — Moderar rascunho (vaga, CV ou serviço)', () => {
  // ───────────── #121 — máquina de estados (regras puras) · AC6 ─────────────
  describe('AC6 / #121 — máquina de estados (TRANSITIONS + regras puras)', () => {
    it.each([
      [JOB, 'DRAFT', 'IN_MODERATION', 'AUTHOR_ACTION'],
      [JOB, 'IN_MODERATION', 'ACTIVE', 'MODERATOR_ACTION'],
      [JOB, 'IN_MODERATION', 'AWAITING_ADJUSTMENTS', 'MODERATOR_ACTION'],
      [JOB, 'IN_MODERATION', 'REJECTED', 'MODERATOR_ACTION'],
      ['CV', 'IN_MODERATION', 'ACTIVE', 'MODERATOR_ACTION'],
      ['SERVICE', 'IN_MODERATION', 'ACTIVE', 'MODERATOR_ACTION'],
    ])('aceita transição válida %s %s→%s (%s)', (kind, from, to, trigger) => {
      expect(isValidTransition(kind, from, to, trigger)).toBe(true);
    });

    it.each([
      [JOB, 'REJECTED', 'ACTIVE', 'MODERATOR_ACTION'],
      [JOB, 'ACTIVE', 'IN_MODERATION', 'MODERATOR_ACTION'],
      [JOB, 'DRAFT', 'ACTIVE', 'MODERATOR_ACTION'],
      ['CV', 'IN_MODERATION', 'EXPIRED', 'SYSTEM_JOB'], // CV não tem EXPIRED
    ])('rejeita transição inválida %s %s→%s (%s)', (kind, from, to, trigger) => {
      expect(isValidTransition(kind, from, to, trigger)).toBe(false);
    });

    it('exige justificativa em devolver/rejeitar/inativar', () => {
      expect(requiresJustification(JOB, 'IN_MODERATION', 'AWAITING_ADJUSTMENTS', 'MODERATOR_ACTION')).toBe(true);
      expect(requiresJustification(JOB, 'IN_MODERATION', 'REJECTED', 'MODERATOR_ACTION')).toBe(true);
      expect(requiresJustification(JOB, 'ACTIVE', 'INACTIVATED', 'COORDINATOR_INACTIVATION')).toBe(true);
    });

    it('não exige justificativa em aprovar', () => {
      expect(requiresJustification(JOB, 'IN_MODERATION', 'ACTIVE', 'MODERATOR_ACTION')).toBe(false);
    });
  });

  // ───────────── #122 — transitionContent (transação + auditoria + side effects) ─────────────
  describe('AC5 / AC6 / P-006 / #122 — transitionContent', () => {
    it('E-002: IN_MODERATION→ACTIVE grava auditoria CONTENT_APPROVED na mesma transação e dispara e-mail', async () => {
      const res = await transitionContent({ ...CONTENT, to: 'ACTIVE', trigger: 'MODERATOR_ACTION', actorPersonId: 'mod-1' });
      expect(res).toMatchObject({ ok: true, data: { from: 'IN_MODERATION', to: 'ACTIVE' } });
      // E: withAudit('CONTENT_APPROVED') na mesma tx · NotificationPort.sendModerationDecision chamado
    });

    it('AC6: transição não declarada retorna INVALID_TRANSITION sem alterar status', async () => {
      const res = await transitionContent({ ...CONTENT, to: 'ACTIVE', trigger: 'MODERATOR_ACTION', actorPersonId: 'mod-1' });
      // contexto: item em REJECTED
      expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
    });

    it('P-003: devolver/rejeitar sem justificativa significativa retorna JUSTIFICATION_REQUIRED', async () => {
      const res = await transitionContent({ ...CONTENT, to: 'REJECTED', trigger: 'MODERATOR_ACTION', justification: 'x', actorPersonId: 'mod-1' });
      expect(res).toMatchObject({ ok: false, error: { code: 'JUSTIFICATION_REQUIRED' } });
    });

    it('R3/concorrência: segunda decisão sobre o mesmo item falha por INVALID_TRANSITION', async () => {
      // contexto: UPDATE ... WHERE status = current (otimista); 1ª aplica, 2ª não casa
      const res = await transitionContent({ ...CONTENT, to: 'ACTIVE', trigger: 'MODERATOR_ACTION', actorPersonId: 'mod-2' });
      expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
    });

    it.todo('R2: falha de side effect (e-mail) é soft-fail e NÃO aborta a transição');
  });

  // ───────────── #123 — actions de decisão + fila ─────────────
  describe('E-002/E-003/E-004 / #123 — actions de decisão', () => {
    it('E-002: approveContent retorna sucesso para item em IN_MODERATION', async () => {
      const res = await approveContent(CONTENT);
      expect(res).toMatchObject({ ok: true });
    });

    it('E-003: returnForAdjustments com motivo válido (≥20) retorna sucesso', async () => {
      const res = await returnForAdjustments({ ...CONTENT, justification: 'Faltou descrever as atividades do cargo anterior' });
      expect(res).toMatchObject({ ok: true });
    });

    it('E-004: rejectContent com motivo válido retorna sucesso', async () => {
      const res = await rejectContent({ ...CONTENT, justification: 'Conteúdo incompatível com as diretrizes do portal' });
      expect(res).toMatchObject({ ok: true });
    });

    it.each([['', 'vazio'], ['x', 'caractere único'], ['—', 'traço'], ['ok', 'genérico'], ['ajustar', 'genérico curto']])(
      'P-003: rejeita motivo "%s" (%s) com VALIDATION/JUSTIFICATION_REQUIRED',
      async (motivo) => {
        const res = await returnForAdjustments({ ...CONTENT, justification: motivo });
        expect(res).toMatchObject({ ok: false });
        // E: error.code ∈ { 'VALIDATION', 'JUSTIFICATION_REQUIRED' } com mensagem PT-BR
      },
    );

    it('P-007: decisão por usuário sem permissão de moderação retorna FORBIDDEN', async () => {
      // contexto: requirePermission(MODERATE_*) recusa
      const res = await approveContent(CONTENT);
      expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    });
  });

  describe('E-001 / P-005 / #123 — fila do coordenador', () => {
    it('E-001: lista apenas IN_MODERATION ordenado por data de envio (ASC)', async () => {
      const fila = await viewModerationQueue({ viewerPersonId: 'cleia' });
      // E: todos os itens com status IN_MODERATION
      // E: ordenados por submittedAt crescente
      expect(Array.isArray(fila)).toBe(true);
    });

    it('P-005: exclui da fila itens cujo autor é o próprio moderador (autor≠moderador)', async () => {
      const fila = await viewModerationQueue({ viewerPersonId: 'cleia' });
      // E: nenhum item com authorPersonId === 'cleia'
      expect(fila).toBeDefined();
    });

    it.todo('L-001: listagem da fila responde ≤ 2s p95 (take + select explícito)');
  });

  // ───────────── Diferidos / cross-US ─────────────
  describe('Diferidos / cross-US (não implementar nesta US)', () => {
    it.todo('E-005/P-001 — alerta de fila (>10 pendentes ou item >48h) — DIFERIDO (GAP-5)');
    it.todo('P-002 — painel de Empresa não verificada — USP-017');
    it.todo('P-004 — atalho de inativação — USP-018');
  });
});
