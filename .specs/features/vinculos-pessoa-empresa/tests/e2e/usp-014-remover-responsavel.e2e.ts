// .specs/features/vinculos-pessoa-empresa/tests/e2e/usp-014-remover-responsavel.e2e.ts
// FACTS E2E (red) — mover para e2e/companies/ na fase Execute.
// Fluxo de operação de Empresa (candidato a Top 8 — confirmar em architecture-document §6).
// Marcados test.fixme para não quebrar a suite de CI até a implementação.
import { test, expect } from '@playwright/test'

test.describe('USP-014 — Remover responsável de uma Empresa', () => {
  test.fixme('AC-014-1 — remover um co-responsável quando há dois ativos', async ({ page }) => {
    // Autenticado como responsável ATIVO da Empresa, com outro responsável ativo
    await page.goto('/empresa/uuid-empresa/responsaveis')
    await expect(page.getByText(/Bruno/)).toBeVisible()
    await page.getByRole('button', { name: /remover/i }).first().click()
    // Diálogo de confirmação com motivo opcional
    await page.getByRole('button', { name: /confirmar remoção/i }).click()
    await expect(page.getByText(/responsável removido/i)).toBeVisible()
    await expect(page.getByText(/Bruno/)).toHaveCount(0)
  })

  test.fixme('AC-014-2 — bloquear a remoção do último responsável ativo', async ({ page }) => {
    // Autenticado como ÚNICO responsável ativo da Empresa
    await page.goto('/empresa/uuid-empresa/responsaveis')
    await page.getByRole('button', { name: /remover/i }).first().click()
    await page.getByRole('button', { name: /confirmar remoção/i }).click()
    await expect(page.getByText(/designe outro responsável antes/i)).toBeVisible()
  })

  test.fixme('AC-014-1 — auto-remoção redireciona (ator perde acesso)', async ({ page }) => {
    // Autenticado como um de dois responsáveis ativos; remove o próprio vínculo
    await page.goto('/empresa/uuid-empresa/responsaveis')
    await page.getByRole('button', { name: /remover/i }).last().click() // linha "Você"
    await page.getByRole('button', { name: /confirmar remoção/i }).click()
    // ADR-0030: na próxima navegação à rota o ator recebe 404 (perdeu o acesso)
    await page.goto('/empresa/uuid-empresa/responsaveis')
    await expect(page.getByText(/404|não encontrad/i)).toBeVisible()
  })
})
