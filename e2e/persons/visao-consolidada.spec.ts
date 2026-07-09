import { test, expect } from '@playwright/test';

/**
 * E2E da visão consolidada da Pessoa (USP-039). A rota
 * `(app)/pessoas/[id]/visao-consolidada` é autenticada e restrita a
 * SOCIAL_ASSISTANT/BOARD/COORDINATOR: o painel consolida dados de OUTRA
 * Pessoa, então o gate de sessão (middleware de borda + `requireActivePerson`
 * no layout `(app)`) é a garantia que só o E2E fecha ponta-a-ponta — mesma
 * decisão de pirâmide de testes de `e2e/ficha-socioeconomica.spec.ts`
 * (L-007 / AD-019: este repo não semeia sessão Supabase no Playwright).
 *
 * Os ramos autenticados — autorização de papel (SOC-039-MN-02), o gate da
 * ficha (SOC-039-MN-01, 2 barreiras), o assembler e a UI do painel — são
 * verificados de forma autoritativa, sem esbarrar no rate limit anônimo, em:
 *   - `src/modules/persons/__tests__/consolidated-person.test.ts` (guarda de domínio),
 *   - `src/modules/persons/__tests__/view-person-for-social-assistant.int.test.ts` (assembler, Postgres real),
 *   - `src/modules/persons/__tests__/ConsolidatedPersonPanel.test.tsx` (UI do painel),
 *   - `src/app/(app)/pessoas/[id]/visao-consolidada/page.test.tsx` (gate de rota, mockado).
 * Aqui travamos o que só o E2E garante: o confinamento real da rota.
 */

const SOME_PERSON_ID = '11111111-1111-4111-8111-111111111111';

test.describe('Visão consolidada da Pessoa (USP-039)', () => {
  test('rota autenticada: acesso sem sessão redireciona para /login', async ({ page }) => {
    await page.goto(`/pessoas/${SOME_PERSON_ID}/visao-consolidada`);
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.locator('h1')).toContainText('Entrar');
  });

  test('rota autenticada: id arbitrário também é confinado (não vaza existência)', async ({
    page,
  }) => {
    await page.goto('/pessoas/qualquer-coisa/visao-consolidada');
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
