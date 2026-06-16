import { test, expect } from '@playwright/test';

/**
 * E2E da edição de dados de Empresa (USP-015). Cobre APENAS o gate de rota
 * `(app)`: sem sessão, o acesso é redirecionado para /login (ADR-0030).
 *
 * O fluxo autenticado completo (editar não-identitário mantém verificada; editar
 * identitário → confirma aviso → rebaixa) é coberto pelos testes de integração da
 * action em src/modules/companies/__tests__/edit-company.int.test.ts e pelos testes
 * de componente em edit-company-form.test.tsx. O E2E autenticado fica adiado até
 * existir infraestrutura de session-seeding (o projeto ainda não semeia sessão de
 * responsável de Empresa no E2E).
 */
test.describe('Editar dados da empresa (USP-015) — gate de rota', () => {
  test('sem sessão → redireciona para /login', async ({ page }) => {
    await page.goto('/empresa/00000000-0000-0000-0000-000000000000/editar');
    await expect(page).toHaveURL(/\/login/);
  });
});
