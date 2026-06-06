/**
 * Esqueleto E2E (Playwright) — USP-004 Autenticar no portal com e-mail e senha.
 * Destino real: e2e/login.spec.ts
 *
 * Top-8 fluxo crítico: autenticação. Skeleton com test.fixme até a UI/rota existirem.
 * Cobre os fluxos ponta-a-ponta dos critérios EARS; asserts finos viram TODO na implementação.
 */

import { test, expect } from '@playwright/test'

const VALID_EMAIL = process.env.E2E_USER_EMAIL ?? 'ana@exemplo.org'
const VALID_PASSWORD = process.env.E2E_USER_PASSWORD ?? 'Senha#Forte1'

test.describe('USP-004 — Login com e-mail e senha', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  // AC-004-1
  test.fixme('AC-004-1: credenciais válidas autenticam e redirecionam à tela inicial', async ({ page }) => {
    await page.getByLabel('E-mail').fill(VALID_EMAIL)
    await page.getByLabel('Senha').fill(VALID_PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL('/')
    // TODO: assert elemento que só aparece autenticado (ex.: menu do usuário)
  })

  // AC-004-2
  test.fixme('AC-004-2: credenciais inválidas exibem mensagem genérica', async ({ page }) => {
    await page.getByLabel('E-mail').fill(VALID_EMAIL)
    await page.getByLabel('Senha').fill('senha-errada')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText('Credenciais inválidas')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
    // A mensagem NÃO deve diferenciar "e-mail não existe" de "senha incorreta".
  })

  // AC-004-3
  test.fixme('AC-004-3: 5 falhas em 15min bloqueiam novas tentativas por 15min', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('E-mail').fill(VALID_EMAIL)
      await page.getByLabel('Senha').fill('senha-errada')
      await page.getByRole('button', { name: 'Entrar' }).click()
      await expect(page.getByText('Credenciais inválidas')).toBeVisible()
    }
    // 6ª tentativa, agora com senha correta — deve ser bloqueada, não autenticar.
    await page.getByLabel('Senha').fill(VALID_PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText(/muitas tentativas|tente novamente em/i)).toBeVisible()
    await expect(page).not.toHaveURL('/')
  })

  // AC-004-4
  test.fixme('AC-004-4: sessão encerra após 12h de inatividade', async ({ page, context }) => {
    // Pré: estar autenticado.
    await page.getByLabel('E-mail').fill(VALID_EMAIL)
    await page.getByLabel('Senha').fill(VALID_PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL('/')

    // Simular >12h de inatividade — estratégia a definir na implementação:
    // expirar cookie de sessão via context.addCookies com expires no passado,
    // ou clock injetável no middleware de sessão.
    // TODO: aplicar expiração de sessão (>12h)
    await page.goto('/perfil')
    await expect(page).toHaveURL(/\/login/)
  })
})
