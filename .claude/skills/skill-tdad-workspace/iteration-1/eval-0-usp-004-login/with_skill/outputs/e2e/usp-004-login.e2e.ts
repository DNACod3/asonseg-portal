// e2e/usp-004-login.e2e.ts
// FACT E2E (red) — mover para e2e/ na fase Execute. Esqueleto test.fixme (não quebra a CI).
//
// NOTA DE ESCOPO: USP-004 NÃO consta explicitamente na lista dos Top 8 fluxos críticos
// (architecture-document §6 — auto-cadastro, reivindicação, ativar papel, publicar vaga,
// candidatura, encaminhamento, CV, moderação, revogação consentimento). No entanto, o login
// é o portão de autenticação de que vários desses fluxos dependem. Este esqueleto cobre o
// happy path e o bloqueio temporário ponta-a-ponta; promover (ou não) para a suíte E2E
// permanente é decisão do Tech Lead no Kickoff Gate.
//
// Fonte: PRD USP-004 · ADR-T-0003 (Supabase Auth + sessão HttpOnly)

import { test, expect } from '@playwright/test'

test.describe('USP-004 — Login com e-mail e senha', () => {
  test.fixme('AC-004-1 — credenciais válidas levam à tela inicial autenticada', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('joao@exemplo.com')
    await page.getByLabel('Senha').fill('SenhaForte!123')
    await page.getByRole('button', { name: /entrar/i }).click()
    await expect(page).toHaveURL(/\/(inicio|perfil)/)
  })

  test.fixme('AC-004-2 — credenciais inválidas mostram mensagem genérica', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('joao@exemplo.com')
    await page.getByLabel('Senha').fill('SenhaErrada')
    await page.getByRole('button', { name: /entrar/i }).click()
    await expect(page.getByText(/credenciais inválidas/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test.fixme('AC-004-3 — após 5 falhas em 15 min a conta fica bloqueada por 15 min', async ({ page }) => {
    await page.goto('/login')
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('E-mail').fill('joao@exemplo.com')
      await page.getByLabel('Senha').fill('SenhaErrada')
      await page.getByRole('button', { name: /entrar/i }).click()
    }
    // 6ª tentativa, mesmo com senha correta, deve mostrar bloqueio temporário.
    await page.getByLabel('Senha').fill('SenhaForte!123')
    await page.getByRole('button', { name: /entrar/i }).click()
    await expect(page.getByText(/temporariamente bloquead/i)).toBeVisible()
  })
})
