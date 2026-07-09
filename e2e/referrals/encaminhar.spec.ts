import { test, expect } from '@playwright/test';

/**
 * E2E do encaminhamento institucional (USP-037). A rota `(app)/encaminhamentos/novo`
 * é autenticada e restrita a coordenador/AS/voluntário delegado (`REFER_PERSON_TO_JOB`
 * — REF-MN-04): o gate de sessão (middleware de borda + `requireActivePerson` no
 * layout `(app)`) é a garantia que só o E2E fecha ponta-a-ponta — mesma decisão de
 * pirâmide de testes de `e2e/ficha-socioeconomica.spec.ts` (L-007 / AD-019: este
 * repo não semeia sessão Supabase no Playwright).
 *
 * Os ramos autenticados — RBAC (REF-MN-04), pré-condições (REF-MN-02/03),
 * unicidade (REF-MN-01), orquestração da tx e a UI do form — são verificados de
 * forma autoritativa, sem esbarrar no rate limit anônimo, em:
 *   - `src/modules/referrals/domain/__tests__/referral-rules.spec.ts` (regra pura),
 *   - `src/modules/referrals/__tests__/referral-schema.spec.ts` (schema),
 *   - `src/modules/referrals/__tests__/create-referral.int.test.ts` (action, Postgres real),
 *   - `src/modules/referrals/components/__tests__/referral-form.spec.tsx` (UI do form),
 *   - `src/app/(app)/encaminhamentos/novo/page.test.tsx` (gate de rota, mockado).
 * Aqui travamos o que só o E2E garante: o confinamento real da rota.
 */

test.describe('Encaminhar Pessoa para vaga (USP-037)', () => {
  test('rota autenticada: acesso sem sessão redireciona para /login', async ({ page }) => {
    await page.goto('/encaminhamentos/novo');
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.locator('h1')).toContainText('Entrar');
  });

  test('rota autenticada: querystring personId/jobId também é confinada (não vaza a página)', async ({
    page,
  }) => {
    await page.goto('/encaminhamentos/novo?personId=11111111-1111-4111-8111-111111111111&jobId=22222222-2222-4222-8222-222222222222');
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
