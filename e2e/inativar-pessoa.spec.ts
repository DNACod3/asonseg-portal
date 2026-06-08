import { test, expect } from '@playwright/test';

/**
 * E2E de "Inativar Pessoa" (USP-007 — #83/#84/#86). A rota `(app)/pessoas/[id]`
 * é autenticada e restrita a coordenador/diretoria: inativar opera sobre OUTRA
 * Pessoa, então o gate de sessão (middleware de borda + `requireActivePerson` no
 * layout `(app)`) é a garantia que só o E2E fecha ponta-a-ponta.
 *
 * Decisão de pirâmide de testes (mesma de `e2e/ativar-papel.spec.ts` e
 * `e2e/login.spec.ts`): os ramos autenticados — autorização sensível ao alvo
 * (diretoria → qualquer Pessoa; coordenador → só voluntário; ninguém a si mesmo),
 * idempotência, concorrência, bloqueio de único responsável de Empresa (E-003) e
 * a UI do diálogo — são verificados de forma autoritativa, sem semear sessão
 * Supabase nem esbarrar no rate limit anônimo, em:
 *   - `src/modules/persons/__tests__/person-inactivation.test.ts` (autorização + schema),
 *   - `src/modules/persons/__tests__/view-person-for-staff.test.ts` (View Model de privacidade),
 *   - `src/modules/persons/__tests__/InactivatePersonDialog.test.tsx` (UI do diálogo),
 *   - `src/modules/persons/__tests__/inactivate-person.int.test.ts` (action + ramos, Postgres real).
 * Aqui travamos o que só o E2E garante: o confinamento da rota.
 */

const SOME_PERSON_ID = '11111111-1111-4111-8111-111111111111';

test.describe('Inativar Pessoa (USP-007)', () => {
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
