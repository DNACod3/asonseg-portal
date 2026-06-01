import { test, expect, type Page } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Gera um CPF válido para testes (fixo para reprodutibilidade). */
const TEST_CPF = '529.982.247-25';

function uniqueEmail(suffix = '') {
  return `test-cadastro-${Date.now()}${suffix}@example.com`;
}

async function fillRegisterForm(
  page: Page,
  opts: {
    name?: string;
    cpf?: string;
    email?: string;
    password?: string;
    role?: string;
  } = {},
) {
  await page.fill('#fullName', opts.name ?? 'Maria Teste');
  await page.fill('#cpf', opts.cpf ?? TEST_CPF);
  await page.fill('#email', opts.email ?? uniqueEmail());
  await page.fill('#password', opts.password ?? 'Senha@1234');

  const role = opts.role ?? 'CANDIDATE';
  await page.check(`input[type="radio"][value="${role}"]`);
}

// ── Testes ───────────────────────────────────────────────────────────────────

test.describe('Auto-cadastro (USP-001)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cadastro');
  });

  test('E-001 — exibe o formulário de cadastro completo', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Criar conta');
    await expect(page.locator('#fullName')).toBeVisible();
    await expect(page.locator('#cpf')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    // Todos os papéis públicos disponíveis
    await expect(page.locator('input[value="CANDIDATE"]')).toBeVisible();
    await expect(page.locator('input[value="PROVIDER"]')).toBeVisible();
    await expect(page.locator('input[value="CLIENT"]')).toBeVisible();

    // Link para login
    await expect(page.locator('a[href="/login"]')).toBeVisible();
  });

  test('P-007 — não oferece campo de exceção de CPF no fluxo público', async ({ page }) => {
    // O formulário público jamais pode ter um campo que permita "Pessoa sem documento"
    await expect(page.locator('[name="cpfExceptionJustification"]')).toHaveCount(0);
    await expect(page.locator('[name="cpfException"]')).toHaveCount(0);
  });

  test('E-005 — rejeita CPF com formato inválido antes de submeter', async ({ page }) => {
    await fillRegisterForm(page, { cpf: '111.111.111-11' });
    // Submit sem CAPTCHA real — valida o erro de CPF via HTML5 / erro de campo
    await page.click('button[type="submit"]');
    await expect(page.locator('#cpf-error, [id$="-error"]')).toContainText(/cpf|inválido/i);
  });

  test('E-003/E-004 — campos obrigatórios geram erros inline', async ({ page }) => {
    await page.click('button[type="submit"]');
    // Deve mostrar erros nos campos obrigatórios
    await expect(page.locator('[role="alert"]').first()).toBeVisible();
  });

  test('E-002 — link de login visível para quem já tem conta', async ({ page }) => {
    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toContainText(/entrar|login/i);
  });

  test.describe('Acessibilidade mínima', () => {
    test('todos os campos têm label associado', async ({ page }) => {
      for (const id of ['fullName', 'cpf', 'email', 'password']) {
        const label = page.locator(`label[for="${id}"]`);
        await expect(label).toBeVisible();
      }
    });

    test('botão de submit tem texto descritivo', async ({ page }) => {
      await expect(page.locator('button[type="submit"]')).toContainText(/criar conta|cadastrar/i);
    });
  });
});

// Nota sobre os testes de "happy path" (E-001, E-006):
// O fluxo completo de cadastro requer:
//   1. CAPTCHA Turnstile: em teste usa-se o site key de teste do Cloudflare (sempre aprova)
//   2. Supabase Auth local rodando (supabase start)
//   3. Variáveis de ambiente configuradas (.env.test.local)
//
// Esses testes ficam na suite de integração E2E (tag @integration) e são
// executados no CI com `supabase start` e `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`.
// Ver: docs/arch/project-guideline.md § Testes E2E.
