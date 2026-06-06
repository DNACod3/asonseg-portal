// tests/e2e/usp-016-moderacao-rascunho.e2e.ts
// FACT E2E (red) — mover para e2e/ na fase Execute.
// USP-016 é o fluxo crítico Top 8 #8 (architecture-document §6:
// "Moderação aprovar/devolver/rejeitar — fluxo de transitionContent + side effects").
// Esqueleto red marcado test.fixme para não quebrar a CI até a implementação.

import { test, expect } from '@playwright/test'

test.describe('USP-016 — Moderação aprovar/devolver/rejeitar (fluxo crítico Top 8)', () => {
  // Pré-condição comum: login como coordenador com permissão de moderar.
  // Na fase Execute, usar fixture de auth (storageState) do coordenador.

  test.fixme('AC-016-1 — fila lista conteúdo em moderação por data de envio', async ({ page }) => {
    await page.goto('/moderacao')
    const linhas = page.getByRole('row')
    await expect(linhas.first()).toBeVisible()
    // E: cada linha exibe badge "Em moderação"; ordenação por data de envio.
  })

  test.fixme('AC-016-2 — coordenador aprova e conteúdo fica visível no portal', async ({ page }) => {
    await page.goto('/moderacao')
    await page.getByRole('row', { name: /Vaga Auxiliar/i }).getByRole('link').click()
    await page.getByRole('button', { name: /aprovar/i }).click()
    await expect(page.getByText(/aprovad/i)).toBeVisible()
    // E: a vaga aparece na listagem pública /vagas (após revalidation).
  })

  test.fixme('AC-016-3 — devolver para ajustes exige motivo', async ({ page }) => {
    await page.goto('/moderacao')
    await page.getByRole('row', { name: /CV João/i }).getByRole('link').click()
    await page.getByRole('button', { name: /devolver para ajustes/i }).click()
    // Sem motivo: submit bloqueado / validação visível.
    await page.getByRole('button', { name: /confirmar/i }).click()
    await expect(page.getByText(/motivo.*obrigat/i)).toBeVisible()
    // Com motivo: transita e mostra confirmação.
    await page.getByLabel(/motivo/i).fill('Foto ilegível, reenviar')
    await page.getByRole('button', { name: /confirmar/i }).click()
    await expect(page.getByText(/aguardando ajustes/i)).toBeVisible()
  })

  test.fixme('AC-016-4 — rejeitar definitivamente exige motivo', async ({ page }) => {
    await page.goto('/moderacao')
    await page.getByRole('row', { name: /Serviço Costura/i }).getByRole('link').click()
    await page.getByRole('button', { name: /rejeitar/i }).click()
    await page.getByLabel(/motivo/i).fill('Conteúdo viola diretrizes')
    await page.getByRole('button', { name: /confirmar/i }).click()
    await expect(page.getByText(/rejeitad/i)).toBeVisible()
  })
})
