import { test, expect } from '@playwright/test';

/**
 * E2E de "Reativar Pessoa" (USP-045 — fluxo inverso da USP-007). A rota
 * `(app)/pessoas/[id]` é autenticada e restrita a coordenador/diretoria:
 * a reativação opera sobre OUTRA Pessoa, então o gate de sessão (middleware de
 * borda + `requireActivePerson` no layout `(app)`) é a garantia que só o E2E
 * fecha ponta-a-ponta.
 *
 * Decisão de pirâmide de testes (mesma de `e2e/inativar-pessoa.spec.ts`): os
 * ramos autenticados — hierarquia de rank (R1/P-002), zeragem de grants (R2/E-003),
 * preservação de consentimentos (P-003), idempotência, concorrência e a UI do
 * diálogo — são verificados de forma autoritativa, sem semear sessão Supabase
 * nem esbarrar no rate limit anônimo, em:
 *   - `src/modules/persons/__tests__/person-reactivation.test.ts` (autorização + schema),
 *   - `src/modules/persons/__tests__/ReactivatePersonDialog.test.tsx` (UI do diálogo),
 *   - `src/modules/persons/__tests__/reactivate-person.int.test.ts` (action + ramos, Postgres real).
 * Aqui travamos o que só o E2E garante: o confinamento da rota.
 */

const SOME_PERSON_ID = '11111111-1111-4111-8111-111111111111';

test.describe('Reativar Pessoa (USP-045)', () => {
  test('rota autenticada: acesso sem sessão redireciona para /login', async ({ page }) => {
    await page.goto(`/pessoas/${SOME_PERSON_ID}`);
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.locator('h1')).toContainText('Entrar');
  });

  test('rota autenticada: id arbitrário também é confinado (não vaza existência)', async ({
    page,
  }) => {
    await page.goto('/pessoas/qualquer-coisa');
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
