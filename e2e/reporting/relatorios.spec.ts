import { test, expect } from '@playwright/test';

/**
 * E2E das rotas de relatório (USP-042 / T12). `(app)/relatorios` e
 * `(app)/relatorios/[tipo]` são autenticadas e restritas por papel — o gate
 * de sessão (middleware de borda + `requireActivePerson` no layout `(app)`)
 * é a garantia que só o E2E fecha ponta-a-ponta — mesma decisão de pirâmide
 * de testes de `e2e/persons/visao-consolidada.spec.ts` (L-007/AD-019: este
 * repo não semeia sessão Supabase no Playwright).
 *
 * RBAC por `reportType` (REL42-MN-02/03/05), o export (REL42-MN-01/06/07) e
 * a privacidade do relatório social (REL42-MN-05) têm cobertura autoritativa
 * em integração/componente:
 *   - `src/modules/reporting/__tests__/report-access.test.ts` (guardas de papel)
 *   - `src/modules/reporting/__tests__/export-report.test.ts` + `.int.test.ts` (export)
 *   - `src/modules/reporting/__tests__/social-report.int.test.ts` (2 barreiras)
 *   - `src/app/(app)/relatorios/[tipo]/page.test.tsx` (gate de rota, mockado)
 * Aqui travamos o que só o E2E garante: o confinamento real das rotas.
 */

test.describe('Relatórios operacionais (USP-042)', () => {
  test('índice: acesso sem sessão redireciona para /login', async ({ page }) => {
    await page.goto('/relatorios');
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.locator('h1')).toContainText('Entrar');
  });

  test('rota por tipo: acesso sem sessão redireciona para /login', async ({ page }) => {
    await page.goto('/relatorios/jobs');
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test('rota por tipo: tipo desconhecido também é confinado (não vaza existência sem sessão)', async ({
    page,
  }) => {
    await page.goto('/relatorios/qualquer-coisa');
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test('rota social: acesso sem sessão redireciona para /login (relatório sensível também confinado)', async ({
    page,
  }) => {
    await page.goto('/relatorios/social');
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
