import { test, expect } from '@playwright/test';

/**
 * E2E de "Ativar papel adicional" (USP-006 — #76/#78/#79). A rota
 * `(app)/perfil/papeis` é autenticada: ativar um papel opera **exclusivamente**
 * sobre a Pessoa da sessão (P-002), então o gate de sessão é a garantia que só o
 * E2E fecha ponta-a-ponta (middleware de borda + `requireActivePerson` no layout
 * `(app)`).
 *
 * Decisão de pirâmide de testes (mesma de `e2e/consentimentos.spec.ts` e
 * `e2e/login.spec.ts`): o fluxo autenticado completo — listar papéis ativáveis,
 * exibir só os campos faltantes (E-001) + o termo da finalidade (P-004), aceitar e
 * ativar com redirect (E-004) — é verificado de forma autoritativa, sem semear
 * sessão Supabase nem esbarrar no rate limit anônimo, em:
 *   - `src/modules/identity/__tests__/ActivateRoleForm.test.tsx` (UI do formulário),
 *   - `src/modules/identity/__tests__/build-activatable-options.test.ts` (montagem da página),
 *   - `src/modules/identity/__tests__/activate-additional-role.test.ts` (action + ramos),
 *   - `src/modules/identity/__tests__/activate-additional-role.int.test.ts` (Postgres real).
 * Aqui travamos o que só o E2E garante: o confinamento da rota.
 */

test.describe('Ativar papel adicional (USP-006)', () => {
  test('rota autenticada: acesso sem sessão redireciona para /login', async ({ page }) => {
    await page.goto('/perfil/papeis');
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.locator('h1')).toContainText('Entrar');
  });

  test('rota autenticada: sub-rota também é confinada', async ({ page }) => {
    await page.goto('/perfil/papeis/qualquer-coisa');
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
