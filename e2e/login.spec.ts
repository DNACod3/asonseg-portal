import { test, expect } from '@playwright/test';

/**
 * E2E de login (USP-004 — #66 / T-07). Cobre o **contrato de UI** do fluxo de
 * login: renderização, validação client-side e a mensagem genérica única em
 * falha (anti-enumeração — D-G).
 *
 * Decisão de pirâmide de testes: o comportamento de **login válido**, **lockout
 * após 5 falhas** (AC-004-3) e **Pessoa inativa** é verificado de forma
 * autoritativa, ponta-a-ponta contra a stack Supabase, em
 * `src/modules/identity/__tests__/login.int.test.ts` — mais robusto que e2e
 * (que exigiria semear credencial e esbarra no rate limit anônimo de 10/min ao
 * repetir tentativas). Aqui validamos o que a UI promete ao usuário.
 */

const GENERIC = 'Credenciais inválidas. Verifique e tente novamente.';

function uniqueEmail() {
  return `e2e-login-${Date.now()}@example.com`;
}

test.describe('Login (USP-004)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('exibe o formulário de login', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Entrar');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#senha')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Criar conta' })).toBeVisible();
  });

  test('validação client-side: e-mail com formato inválido', async ({ page }) => {
    await page.fill('#email', 'nao-email');
    await page.fill('#senha', 'senha12345');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('#email-error')).toBeVisible();
    await expect(page.locator('#email-error')).toContainText('inválido');
  });

  test('credenciais inválidas → mensagem genérica única (anti-enumeração)', async ({ page }) => {
    await page.fill('#email', uniqueEmail());
    await page.fill('#senha', 'senha-errada-123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    // Filtra pelo texto: além do alerta de erro do form, o Next mantém um
    // `role="alert"` vazio (#__next-route-announcer__) que tornaria o seletor ambíguo.
    await expect(page.getByRole('alert').filter({ hasText: GENERIC })).toBeVisible();
  });
});
