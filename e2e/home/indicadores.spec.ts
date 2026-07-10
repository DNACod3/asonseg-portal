import { test, expect } from '@playwright/test';

/**
 * E2E público (USP-041 / T5 — E-001/E-002). Home é ISR pública: o visitante
 * anônimo (sem sessão) vê os 3 rótulos de indicador e a página carrega com
 * 200. Não asserta números absolutos (dependem do estado do banco de
 * teste/seed) — só que a UI renderiza os 3 indicadores sem exigir login
 * (contraste com L-007: não precisa de seed de sessão Supabase).
 */
test.describe('USP-041 — indicadores da home pública (anônimo)', () => {
  test('visitante anônimo vê os 3 rótulos de indicador e a home carrega sem login', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);

    await expect(
      page.getByRole('heading', { name: /Portal de Empregabilidade e Serviços/i }),
    ).toBeVisible();

    await expect(page.getByText('Vagas ativas')).toBeVisible();
    await expect(page.getByText('Candidatos')).toBeVisible();
    await expect(page.getByText('Empresas verificadas')).toBeVisible();
  });
});
