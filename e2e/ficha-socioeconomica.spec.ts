import { test, expect } from '@playwright/test';

/**
 * E2E da ficha socioeconômica (USP-036). A rota `(app)/pessoas/[id]/ficha-social`
 * é autenticada e restrita a SOCIAL_ASSISTANT/BOARD: ficha socioeconômica opera
 * sobre OUTRA Pessoa, então o gate de sessão (middleware de borda +
 * `requireActivePerson` no layout `(app)`) é a garantia que só o E2E fecha
 * ponta-a-ponta — mesma decisão de pirâmide de testes de `e2e/inativar-pessoa.spec.ts`
 * (L-007 / AD-019: este repo não semeia sessão Supabase no Playwright).
 *
 * Os ramos autenticados — autorização de papel (SOC-036-MN-01), persistência/
 * auditoria (SOC-036-MN-02), o serializer e a UI do form — são verificados de
 * forma autoritativa, sem esbarrar no rate limit anônimo, em:
 *   - `src/modules/persons/__tests__/socioeconomic-record-domain.test.ts` (guarda de papel),
 *   - `src/modules/persons/__tests__/socioeconomic-record-schema.test.ts` (schema),
 *   - `src/modules/persons/__tests__/view-socioeconomic-record.test.ts` (View Model),
 *   - `src/modules/persons/__tests__/SocioeconomicRecordForm.test.tsx` (UI do form),
 *   - `src/modules/persons/__tests__/save-socioeconomic-record.int.test.ts` (action, Postgres real),
 *   - `src/modules/persons/__tests__/get-socioeconomic-record.int.test.ts` (query, Postgres real),
 *   - `src/app/(app)/pessoas/[id]/ficha-social/page.test.tsx` (gate de rota, mockado).
 * Aqui travamos o que só o E2E garante: o confinamento real da rota.
 */

const SOME_PERSON_ID = '11111111-1111-4111-8111-111111111111';

test.describe('Ficha socioeconômica (USP-036)', () => {
  test('rota autenticada: acesso sem sessão redireciona para /login', async ({ page }) => {
    await page.goto(`/pessoas/${SOME_PERSON_ID}/ficha-social`);
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.locator('h1')).toContainText('Entrar');
  });

  test('rota autenticada: id arbitrário também é confinado (não vaza existência)', async ({
    page,
  }) => {
    await page.goto('/pessoas/qualquer-coisa/ficha-social');
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
