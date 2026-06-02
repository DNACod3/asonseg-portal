import { test, expect } from '@playwright/test';

/**
 * E2E do painel "Meus consentimentos" (USP-043 — #39). Cobre a **garantia de
 * privacidade** ponta-a-ponta: a rota `(app)/consentimentos` é autenticada e
 * **nunca** é alcançável sem sessão — o titular só vê os próprios consentimentos.
 *
 * Decisão de pirâmide de testes (mesma de `e2e/login.spec.ts`): o fluxo
 * autenticado completo (listar vigentes/revogados, abrir o termo, revogar com
 * confirmação + cascata de papel) é verificado de forma autoritativa, sem
 * depender de semear sessão nem esbarrar no rate limit anônimo, em:
 *   - `src/modules/consents/__tests__/consents-panel.test.tsx` (UI do painel),
 *   - `src/modules/consents/__tests__/revoke-consent.test.ts` (action + cascata),
 *   - `src/modules/consents/__tests__/consents.int.test.ts` (Postgres real).
 * Aqui travamos o que só o E2E garante: o confinamento da rota (middleware de
 * borda + `requireActivePerson` no layout `(app)`).
 */

test.describe('Painel de consentimentos (USP-043)', () => {
  test('rota autenticada: acesso sem sessão redireciona para /login', async ({ page }) => {
    await page.goto('/consentimentos');
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.locator('h1')).toContainText('Entrar');
  });

  test('rota autenticada: sub-rota também é confinada', async ({ page }) => {
    await page.goto('/consentimentos/qualquer-coisa');
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
