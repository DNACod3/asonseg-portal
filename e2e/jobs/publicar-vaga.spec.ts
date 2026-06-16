import { test, expect } from '@playwright/test';

/**
 * E2E de "Publicar vaga" (USP-020 — #161/#165). A rota
 * `(app)/empresa/[empresaId]/vagas/nova` é autenticada e restrita ao responsável
 * ATIVO da Empresa (P-006); o gate de sessão (middleware de borda +
 * `requireActivePerson` no layout `(app)`) é a garantia que só o E2E fecha
 * ponta-a-ponta. Top-flow #3 (architecture-document §6), 1ª perna: publicar → em moderação.
 *
 * Decisão de pirâmide de testes (mesma de `e2e/companies/editar-empresa.spec.ts` e
 * `e2e/moderacao/moderar-rascunho.spec.ts`): os ramos autenticados — rascunho persiste
 * DRAFT (E-003), submit válido → IN_MODERATION + auditoria (E-001/L-004), validade
 * passada/excede teto (E-004/E-005), gate de responsável ativo/PENDING (P-006/D-005),
 * dedup exata (P-003) e concorrência (INVALID_TRANSITION) — são verificados de forma
 * autoritativa, sem semear sessão Supabase, em:
 *   - `src/modules/jobs/__tests__/validade.spec.ts` (regra pura de validade),
 *   - `src/modules/jobs/__tests__/create-job-draft.int.test.ts` (rascunho + gate + dedup, Postgres real),
 *   - `src/modules/jobs/__tests__/submit-job-for-moderation.int.test.ts` (submit → FSM + audit + concorrência, Postgres real).
 * Aqui travamos o que só o E2E garante: o confinamento da rota.
 */
test.describe('Publicar vaga (USP-020) — gate de rota', () => {
  test('rota autenticada: acesso sem sessão redireciona para /login', async ({ page }) => {
    await page.goto('/empresa/00000000-0000-0000-0000-000000000000/vagas/nova');
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
