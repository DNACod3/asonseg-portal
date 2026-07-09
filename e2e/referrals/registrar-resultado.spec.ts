import { test, expect } from '@playwright/test';

/**
 * E2E do registro de resultado do encaminhamento (USP-038). A rota
 * `(app)/encaminhamentos/[id]/resultado` é autenticada e restrita a
 * coordenador/AS/voluntário delegado (`REGISTER_REFERRAL_RESULT` — REF38-MN-02):
 * o gate de sessão (middleware de borda + `requireActivePerson` no layout
 * `(app)`) é a garantia que só o E2E fecha ponta-a-ponta — mesma decisão de
 * pirâmide de testes de `e2e/referrals/encaminhar.spec.ts` (L-007 / AD-019).
 *
 * Os ramos autenticados — RBAC (REF38-MN-02), enum restrito (REF38-MN-01),
 * proveniência (REF38-MN-03), orquestração da tx e a UI do form são
 * verificados de forma autoritativa em:
 *   - `src/modules/referrals/__tests__/register-result-schema.spec.ts` (schema),
 *   - `src/modules/referrals/__tests__/register-referral-result.int.test.ts` (action, Postgres real),
 *   - `src/modules/referrals/components/__tests__/result-form.spec.tsx` (UI do form),
 *   - `src/app/(app)/encaminhamentos/[id]/resultado/page.test.tsx` (gate de rota, mockado).
 * Aqui travamos o que só o E2E garante: o confinamento real da rota.
 */

const SOME_REFERRAL_ID = '11111111-1111-4111-8111-111111111111';

test.describe('Registrar resultado do encaminhamento (USP-038)', () => {
  test('rota autenticada: acesso sem sessão redireciona para /login', async ({ page }) => {
    await page.goto(`/encaminhamentos/${SOME_REFERRAL_ID}/resultado`);
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.locator('h1')).toContainText('Entrar');
  });

  test('rota autenticada: id arbitrário também é confinado (não vaza existência)', async ({ page }) => {
    await page.goto('/encaminhamentos/qualquer-coisa/resultado');
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
