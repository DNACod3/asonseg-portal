import { test, expect } from '@playwright/test';

/**
 * E2E de "Moderar rascunho" (USP-016 — #121/#122/#123). A rota `(app)/moderacao`
 * é autenticada e restrita a coordenador/voluntário com delegação de moderação;
 * moderar opera sobre conteúdo de OUTRA Pessoa, então o gate de sessão
 * (middleware de borda + `requireActivePerson` no layout `(app)`) é a garantia
 * que só o E2E fecha ponta-a-ponta.
 *
 * Decisão de pirâmide de testes (mesma de `e2e/inativar-pessoa.spec.ts` e
 * `e2e/login.spec.ts`): os ramos autenticados — encadeamento aprovar/devolver/
 * rejeitar e o gating por permissão (P-007), o motivo ≥20 significativo (P-003),
 * a transição validada na mesma transação com auditoria (AC5/AC6), a ordem da
 * fila e o autor≠moderador (E-001/P-005) — são verificados de forma autoritativa,
 * sem semear sessão Supabase nem esbarrar no rate limit anônimo, em:
 *   - `src/modules/moderation/actions/__tests__/decide.test.ts` (Zod → permissão → transição),
 *   - `src/modules/moderation/domain/__tests__/transition-rules.test.ts` (máquina de estados),
 *   - `src/modules/moderation/schemas/__tests__/decision.test.ts` (motivo significativo),
 *   - `src/modules/moderation/__tests__/transition-content.int.test.ts` (transação + audit + concorrência, Postgres real),
 *   - `src/modules/moderation/queries/__tests__/moderation-queue.int.test.ts` (ordem + autor≠moderador, Postgres real).
 * Aqui travamos o que só o E2E garante: o confinamento da rota.
 */

test.describe('Moderar rascunho (USP-016)', () => {
  test('rota autenticada: acesso sem sessão redireciona para /login', async ({ page }) => {
    await page.goto('/moderacao');
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.locator('h1')).toContainText('Entrar');
  });
});
