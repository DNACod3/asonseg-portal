import { test, expect } from '@playwright/test';

test('home pública carrega', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Portal de Empregabilidade e Serviços/i }),
  ).toBeVisible();
});
