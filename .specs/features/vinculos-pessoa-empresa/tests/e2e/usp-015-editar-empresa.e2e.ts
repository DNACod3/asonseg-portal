// .specs/features/vinculos-pessoa-empresa/tests/e2e/usp-015-editar-empresa.e2e.ts
// FACTS E2E (red) — mover para e2e/companies/ na fase Execute.
// Fluxo de edição de Empresa (candidato a Top 8 — confirmar em architecture-document §6).
// Marcados test.fixme para não quebrar a suite de CI até a implementação.
import { test, expect } from '@playwright/test'

test.describe('USP-015 — Editar dados da Empresa', () => {
  test.fixme('AC-015-1 — editar descrição mantém a Empresa verificada', async ({ page }) => {
    // Autenticado como responsável ATIVO de uma Empresa verificada
    await page.goto('/empresa/uuid-empresa/editar')
    await page.getByLabel(/descrição/i).fill('Pães artesanais e cafés especiais')
    await page.getByRole('button', { name: /salvar/i }).click()
    await expect(page.getByText(/dados atualizados/i)).toBeVisible()
    // Sem diálogo de re-verificação para campo não-identitário
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test.fixme('AC-015-2 — editar nome fantasia exige confirmação e rebaixa verificação', async ({ page }) => {
    await page.goto('/empresa/uuid-empresa/editar')
    await page.getByLabel(/nome fantasia/i).fill('Padaria Aurora & Cia')
    await page.getByRole('button', { name: /salvar/i }).click()
    // D-015-E: diálogo de aviso antes do envio
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/nova verificação manual/i)).toBeVisible()
    await dialog.getByRole('button', { name: /confirmar/i }).click()
    await expect(page.getByText(/dados atualizados/i)).toBeVisible()
  })

  test.fixme('P-004 — não-responsável recebe 404 na rota de edição', async ({ page }) => {
    // Autenticado como Pessoa que NÃO é responsável da Empresa
    await page.goto('/empresa/uuid-empresa/editar')
    await expect(page.getByText(/404|não encontrad/i)).toBeVisible()
  })
})
