// .specs/features/moderar-rascunho/tests/e2e/usp-016-moderar-rascunho.e2e.ts
// FACT E2E (red) — mover para e2e/ na fase Execute.
// Fluxo crítico Top 8 nº 8 (architecture-document §6): "Moderação aprovar/devolver/rejeitar (USP-016)".
// Esqueleto red marcado test.fixme para não quebrar a CI até a implementação.
//
// Fonte: PRD USP-016 (AC-016-1..5) · ADR-T-0011 · technical-design §3.3.

import { test, expect } from '@playwright/test'

test.describe('USP-016 — Moderar rascunho (fluxo crítico)', () => {
  test.fixme('AC-016-1 — coordenador vê a fila com rascunhos em moderação ordenados por data de envio', async ({ page }) => {
    // Pré: login como coordenador com permissão MODERATE_JOB
    await page.goto('/moderacao')
    await expect(page.getByRole('heading', { name: /fila de moderação/i })).toBeVisible()
    // E: lista exibe apenas itens "em moderação", ordem por data de envio (mais antigo primeiro)
  })

  test.fixme('AC-016-2 — coordenador aprova e conteúdo fica ativo', async ({ page }) => {
    await page.goto('/moderacao')
    await page.getByRole('link', { name: /abrir/i }).first().click()
    await page.getByRole('button', { name: /aprovar/i }).click()
    await expect(page.getByText(/aprovado|ativo/i)).toBeVisible()
  })

  test.fixme('AC-016-3 — devolver para ajustes exige motivo e notifica autor', async ({ page }) => {
    await page.goto('/moderacao')
    await page.getByRole('link', { name: /abrir/i }).first().click()
    await page.getByRole('button', { name: /devolver para ajustes/i }).click()
    // tentativa sem motivo deve bloquear
    await page.getByRole('button', { name: /confirmar/i }).click()
    await expect(page.getByText(/motivo é obrigatório/i)).toBeVisible()
    // com motivo, deve concluir
    await page.getByLabel(/motivo/i).fill('Faltam dados de contato')
    await page.getByRole('button', { name: /confirmar/i }).click()
    await expect(page.getByText(/aguardando ajustes/i)).toBeVisible()
  })

  test.fixme('AC-016-4 — rejeitar definitivamente exige motivo', async ({ page }) => {
    await page.goto('/moderacao')
    await page.getByRole('link', { name: /abrir/i }).first().click()
    await page.getByRole('button', { name: /rejeitar/i }).click()
    await page.getByLabel(/motivo/i).fill('Conteúdo fora de escopo')
    await page.getByRole('button', { name: /confirmar/i }).click()
    await expect(page.getByText(/rejeitado/i)).toBeVisible()
  })
})
