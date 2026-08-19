import { test, expect } from '@playwright/test';

/**
 * Smoke da home pública: a rota responde e renderiza a casca esperada.
 *
 * Assere **estrutura**, não copy. A copy do hero é fixada no unit colocado ao
 * componente (`(public)/_components/__tests__/home-hero.test.tsx`). Duplicá-la
 * aqui foi o que quebrou este smoke: a USP-047 (Fase 7) reescreveu a home, o
 * unit acompanhou por estar ao lado do componente, e o E2E ficou para trás —
 * vermelho por ~1 mês sem ninguém ver, porque a suíte só roda em push pro
 * master ou PR com a label `e2e`.
 */
test('home pública carrega', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBeLessThan(400);

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Buscar Vagas' }).first()).toBeVisible();
});
