import { test, expect } from '@playwright/test';

/**
 * E2E da remoção de responsável de Empresa (USP-014). Cobre APENAS o gate de rota
 * `(app)`: sem sessão, o acesso à página de responsáveis (onde mora o botão
 * "remover") é redirecionado para /login (ADR-0030).
 *
 * O fluxo autenticado completo (listar → remover → bloqueio do último →
 * auto-remoção) é coberto pelos testes de integração em
 * src/modules/companies/__tests__/remove-responsible.int.test.ts. O E2E autenticado
 * fica adiado até existir infraestrutura de session-seeding de responsável de
 * Empresa no E2E (mesmo motivo da USP-013).
 */
test.describe('Remover responsável da empresa (USP-014) — gate de rota', () => {
  test('sem sessão → redireciona para /login', async ({ page }) => {
    await page.goto('/empresa/00000000-0000-0000-0000-000000000000/responsaveis');
    await expect(page).toHaveURL(/\/login/);
  });
});
