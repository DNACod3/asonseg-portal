import { test, expect } from '@playwright/test';

/**
 * E2E de recuperação de senha (USP-005 — #72). Cobre o **contrato de UI** do
 * fluxo: o atalho a partir do login, a renderização e a validação client-side do
 * formulário de solicitação, e o tratamento de link sem token na página de
 * redefinição.
 *
 * Decisão de pirâmide de testes: o round-trip completo (gerar link 24h, mensagem
 * genérica anti-enumeração, uso único do token) é verificado de forma
 * autoritativa nas Server Actions em `src/modules/identity/__tests__/
 * password-reset.test.ts`. Aqui não completamos o CAPTCHA/envio real (exige a
 * stack Supabase + Cloudflare), igual ao E2E de auto-cadastro (USP-001).
 */

test.describe('Recuperação de senha (USP-005)', () => {
  test('atalho "Esqueci minha senha" no login leva à página de recuperação', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
    await expect(page).toHaveURL(/\/recuperar-senha$/);
    await expect(page.locator('h1')).toContainText('Recuperar senha');
  });

  test('exibe o formulário de solicitação', async ({ page }) => {
    await page.goto('/recuperar-senha');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar link de recuperação' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Voltar para o login' })).toBeVisible();
  });

  test('validação client-side: e-mail com formato inválido', async ({ page }) => {
    await page.goto('/recuperar-senha');
    await page.fill('#email', 'nao-email');
    await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
    await expect(page.locator('#email-error')).toContainText('válido');
  });

  test('redefinição sem token → orienta a solicitar novo link', async ({ page }) => {
    await page.goto('/redefinir-senha');
    await expect(page.getByRole('alert')).toContainText('Link inválido ou incompleto');
    await expect(page.getByRole('link', { name: 'Solicitar novo link' })).toBeVisible();
    // Sem o formulário de nova senha quando o token está ausente.
    await expect(page.locator('#senhaNova')).toHaveCount(0);
  });
});
