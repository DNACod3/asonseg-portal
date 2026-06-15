import { test, expect } from '@playwright/test';

/**
 * E2E da gestão de responsáveis de Empresa (USP-013). Cobre APENAS o gate de rota
 * `(app)`: sem sessão, o acesso é redirecionado para /login (ADR-0030).
 *
 * O fluxo autenticado completo (adicionar → e-mail → aceitar) é coberto pelos
 * testes de integração em src/modules/companies/__tests__. O E2E autenticado fica
 * adiado até existir infraestrutura de session-seeding (o projeto ainda não semeia
 * sessão de responsável de Empresa no E2E).
 */
test.describe('Responsáveis da empresa (USP-013) — gate de rota', () => {
  test('sem sessão → redireciona para /login', async ({ page }) => {
    await page.goto('/empresa/00000000-0000-0000-0000-000000000000/responsaveis');
    await expect(page).toHaveURL(/\/login/);
  });
});
