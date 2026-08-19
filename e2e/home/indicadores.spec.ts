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

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Escopado ao bloco de indicadores: 'Candidatos' também é heading de coluna
    // do rodapé (USP-046), então `getByText` no escopo da página inteira vira
    // ambíguo. Os rótulos são o contrato de E-002 e seguem asseridos — só que
    // no lugar certo. A copy do hero fica com o unit do componente.
    const indicators = page.getByTestId('home-indicators');
    await expect(indicators.getByText('Vagas ativas')).toBeVisible();
    await expect(indicators.getByText('Candidatos')).toBeVisible();
    await expect(indicators.getByText('Empresas verificadas')).toBeVisible();
  });
});
