// .specs/features/extracao-cv-ia/tests/e2e/usp-040-extracao-cv.e2e.ts
// FACT E2E (red) — mover para e2e/ na fase Execute.
// Fluxo crítico Top 8 #7 (architecture-document §6): "Upload + extração de CV".
// Em E2E o provedor LLM é mockado/stubado (não chamar Anthropic real no CI); a qualidade
// da extração é coberta pela eval suite (§21), não pelo E2E.
//
// Fontes: PRD §5.2 USP-040 · ADR-T-0012 · ADR-T-0009 (finalidade 7) · architecture-document §6.
// test.fixme para não quebrar a suite de CI até a implementação preencher o fluxo.

import { test, expect } from '@playwright/test'

test.describe('USP-040 — Upload + extração de CV (fluxo crítico Top 8 #7)', () => {
  test.fixme(
    'AC-040-1/AC-040-2 — candidato com consentimento faz upload, vê campos pré-preenchidos para validação',
    async ({ page }) => {
      // Pré: candidato autenticado com consentimento CV_AI_EXTRACTION ativo; extractor stubado.
      await page.goto('/candidato/perfil/cv')
      await page.getByLabel(/currículo|currículo|cv/i).setInputFiles('e2e/fixtures/curriculo-sintetico.pdf')
      await page.getByRole('button', { name: /enviar|extrair/i }).click()
      // Campos pré-preenchidos e marcados como "extraído automaticamente — requer validação"
      await expect(page.getByText(/extraído automaticamente/i)).toBeVisible()
      await expect(page.getByLabel(/escolaridade/i)).not.toHaveValue('')
    },
  )

  test.fixme('AC-040-4 — salvar sem confirmar é bloqueado; confirmar persiste', async ({ page }) => {
    await page.goto('/candidato/perfil/cv')
    // tentar salvar sem confirmar -> bloqueio com pedido de confirmação explícita
    await page.getByRole('button', { name: /salvar/i }).click()
    await expect(page.getByText(/confirme.*campos|confirmação obrigatória/i)).toBeVisible()
    // confirmar e salvar
    await page.getByRole('checkbox', { name: /confirmo|revisei/i }).check()
    await page.getByRole('button', { name: /salvar/i }).click()
    await expect(page.getByText(/perfil (salvo|atualizado)/i)).toBeVisible()
  })

  test.fixme('AC-040-3 — falha de extração degrada para preenchimento manual sem erro disruptivo', async ({ page }) => {
    // extractor stubado para retornar erro (TIMEOUT/PROVIDER_ERROR)
    await page.goto('/candidato/perfil/cv')
    await page.getByLabel(/currículo|currículo|cv/i).setInputFiles('e2e/fixtures/curriculo-sintetico.pdf')
    await page.getByRole('button', { name: /enviar|extrair/i }).click()
    // sem toast/alert de erro bloqueante; campos vazios para preenchimento manual
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByLabel(/escolaridade/i)).toHaveValue('')
  })

  test.fixme('Consentimento — sem CV_AI_EXTRACTION o upload exibe o termo da finalidade', async ({ page }) => {
    // candidato SEM consentimento da finalidade 7
    await page.goto('/candidato/perfil/cv')
    await page.getByLabel(/currículo|currículo|cv/i).setInputFiles('e2e/fixtures/curriculo-sintetico.pdf')
    await page.getByRole('button', { name: /enviar|extrair/i }).click()
    // a UI mostra o termo da finalidade CV_AI_EXTRACTION (citando o provedor) e pede aceite
    await expect(page.getByText(/consentimento|termo.*extração de cv/i)).toBeVisible()
  })
})
