// .specs/features/vinculos-pessoa-empresa/tests/e2e/usp-013-adicionar-responsavel.e2e.ts
// FACTS E2E (red) — mover para e2e/companies/ na fase Execute.
// Fluxo de operação de Empresa (candidato a Top 8 — confirmar em architecture-document §6).
// Marcados test.fixme para não quebrar a suite de CI até a implementação.
import { test, expect } from '@playwright/test'

test.describe('USP-013 — Adicionar responsável (fluxo pendente+aceite)', () => {
  // --- lado do responsável que adiciona ---
  test.fixme('E-001/P-001 — responsável busca (binária, sem PII) e adiciona Pessoa', async ({ page }) => {
    // Autenticado como responsável ATIVO da Empresa
    await page.goto('/empresa/uuid-empresa/responsaveis')
    await page.getByLabel(/CPF ou e-mail/i).fill('390.533.447-05')
    await page.getByRole('button', { name: /buscar/i }).click()
    // Resposta binária: "Pessoa encontrada" SEM exibir o nome
    await expect(page.getByText(/pessoa encontrada/i)).toBeVisible()
    await expect(page.getByText(/Bruno/)).toHaveCount(0)
    await page.getByRole('button', { name: /confirmar adição/i }).click()
    await expect(page.getByText(/convite pendente de aceite/i)).toBeVisible()
  })

  test.fixme('E-002 — CPF não cadastrado orienta auto-cadastro', async ({ page }) => {
    await page.goto('/empresa/uuid-empresa/responsaveis')
    await page.getByLabel(/CPF ou e-mail/i).fill('000.000.000-00')
    await page.getByRole('button', { name: /buscar/i }).click()
    await expect(page.getByText(/precisa fazer o auto-cadastro/i)).toBeVisible()
  })

  // --- lado da Pessoa adicionada que aceita ---
  test.fixme('P-002/P-003 — Pessoa adicionada aceita via link e passa a operar a Empresa', async ({ page }) => {
    // Autenticado como a Pessoa adicionada; chega pela rota do link de e-mail
    await page.goto('/empresa/uuid-empresa/aceitar-vinculo')
    await page.getByRole('button', { name: /aceitar vínculo/i }).click()
    await expect(page.getByText(/vínculo ativado/i)).toBeVisible()
    // A Empresa passa a aparecer nas opções de operação da Pessoa
    await page.goto('/inicio')
    await expect(page.getByText(/Padaria Aurora/)).toBeVisible()
  })
})
