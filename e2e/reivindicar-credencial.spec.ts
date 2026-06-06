import { test, expect } from '@playwright/test';

/**
 * E2E de reivindicação de credencial (USP-003 — #61). Cobre o **contrato de UI**
 * do fluxo público: renderização e validação client-side do formulário de
 * solicitação, e o atalho de volta ao login.
 *
 * Decisão de pirâmide de testes: o round-trip completo (claim PENDING, mensagem
 * genérica anti-enumeração, e-mail em uso, ativação pela AS) é verificado de
 * forma autoritativa nas Server Actions em `src/modules/identity/__tests__/
 * credential-claim*.test.ts`. Aqui não completamos o CAPTCHA/envio real (exige a
 * stack Supabase + Cloudflare), igual ao E2E de recuperação de senha (USP-005).
 */

test.describe('Reivindicação de credencial (USP-003)', () => {
  test('exibe o formulário de solicitação', async ({ page }) => {
    await page.goto('/reivindicar-credencial');
    await expect(page.locator('h1')).toContainText('Reivindicar credencial');
    await expect(page.locator('#cpf')).toBeVisible();
    await expect(page.locator('#requestedEmail')).toBeVisible();
    await expect(page.locator('#verificationMethod')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Solicitar reivindicação' })).toBeVisible();
  });

  test('validação client-side: e-mail com formato inválido', async ({ page }) => {
    await page.goto('/reivindicar-credencial');
    await page.fill('#cpf', '529.982.247-25');
    await page.fill('#requestedEmail', 'nao-email');
    await page.getByRole('button', { name: 'Solicitar reivindicação' }).click();
    await expect(page.locator('#requestedEmail-error')).toContainText('inválido');
  });

  test('atalho "Entrar" leva à página de login', async ({ page }) => {
    await page.goto('/reivindicar-credencial');
    await page.getByRole('link', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
