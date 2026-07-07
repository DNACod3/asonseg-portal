import { test, expect } from '@playwright/test';

/**
 * E2E de "Inativar conteúdo publicado" (USP-018 — INACT-01..08). A rota
 * `(app)/moderacao/publicados` é autenticada e restrita a coordenador/voluntário
 * com delegação de `INACTIVATE_PUBLISHED_CONTENT`; inativar uma vaga já ACTIVE
 * é uma válvula de escape administrativa, então o gate de sessão (middleware de
 * borda + `requireActivePerson` no layout `(app)`) é a garantia que só o E2E
 * fecha ponta-a-ponta.
 *
 * Decisão de pirâmide de testes (mesma de `e2e/moderacao/moderar-rascunho.spec.ts`
 * e `e2e/inativar-pessoa.spec.ts`): os ramos autenticados — motivo obrigatório
 * ≥20 significativo (INACT-02/MN-02), permissão (INACT-MN-03), transição só a
 * partir de ACTIVE (INACT-07/MN-01), auditoria na mesma transação (INACT-03/MN-05),
 * concorrência, e a exclusão da superfície pública (INACT-MN-04) — são
 * verificados de forma autoritativa, sem semear sessão Supabase nem esbarrar no
 * rate limit anônimo, em:
 *   - `src/modules/moderation/schemas/__tests__/inactivate.test.ts` (motivo significativo),
 *   - `src/modules/moderation/domain/__tests__/transition-rules.test.ts` (INACTIVATED terminal),
 *   - `src/modules/moderation/actions/__tests__/inactivate.test.ts` (Zod → permissão → transição),
 *   - `src/modules/moderation/__tests__/inactivate-content.int.test.ts` (transação + audit + concorrência, Postgres real),
 *   - `src/modules/moderation/__tests__/can-manage-published-content.int.test.ts` (guard, Postgres real),
 *   - `src/modules/jobs/__tests__/list-active-published-jobs.int.test.ts` (listagem ACTIVE-only, Postgres real),
 *   - `src/modules/jobs/__tests__/search-jobs.int.test.ts` + `get-job-detail.int.test.ts` (exclusão pública, INACT-MN-04),
 *   - `src/modules/moderation/components/__tests__/published-content-manager.spec.tsx` (UI do fluxo de inativação).
 * Aqui travamos o que só o E2E garante: o confinamento da rota.
 */

test.describe('Inativar conteúdo publicado (USP-018)', () => {
  test('rota autenticada: acesso sem sessão redireciona para /login', async ({ page }) => {
    await page.goto('/moderacao/publicados');
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.locator('h1')).toContainText('Entrar');
  });
});
