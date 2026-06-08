import { test, expect } from '@playwright/test';

/**
 * E2E de "Configurar permissões delegadas a voluntário" (USP-008). A rota
 * `(app)/permissoes` é autenticada e restrita a COORDINATOR: quem não tem o
 * papel recebe 404 (a rota não revela sua existência). O gate de sessão
 * (middleware de borda + `requireActivePerson` no layout `(app)`) é a garantia
 * que só o E2E fecha ponta-a-ponta.
 *
 * Decisão de pirâmide de testes (mesma de `e2e/reativar-pessoa.spec.ts`): os
 * ramos autenticados — concessão/revogação, FORBIDDEN, NOT_FOUND, CONFLICT,
 * append-only, escopo fail-closed e a UI do gerenciador — são verificados de
 * forma autoritativa, sem semear sessão Supabase nem esbarrar no rate limit
 * anônimo, em:
 *   - `src/modules/identity/__tests__/permissions.test.ts` (regras de checkPermission/escopo),
 *   - `src/modules/identity/__tests__/delegated-permissions.int.test.ts` (grant/revoke + ramos, Postgres real).
 * Aqui travamos o que só o E2E garante: o confinamento da rota.
 */

test.describe('Permissões delegadas (USP-008)', () => {
  test('rota autenticada: acesso sem sessão redireciona para /login', async ({ page }) => {
    await page.goto('/permissoes');
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.locator('h1')).toContainText('Entrar');
  });
});
