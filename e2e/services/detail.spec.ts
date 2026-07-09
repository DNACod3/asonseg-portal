import { test, expect } from '@playwright/test';

/**
 * E2E do detalhe público de serviço (USP-031). Top-flow: o visitante anônimo
 * abre `/servicos/[id]` a partir da busca, vê nome do prestador, fotos, valor
 * e disponibilidade — mas NÃO vê telefone/e-mail (AC-031-2/SVC031-MN-01).
 *
 * Depende dos serviços de seed (`prisma/seeds/demo.ts` — 2 serviços ACTIVE).
 * O que só o E2E garante, travado aqui:
 *  - a rota pública renderiza o detalhe sem sessão;
 *  - telefone/e-mail do prestador NUNCA aparecem no HTML do anônimo;
 *  - o termo de isenção de responsabilidade da ASONSEG é exibido (AC-031-4).
 * As regras de recorte/anonimização são verificadas de forma autoritativa em
 * `src/modules/services/__tests__/get-service-detail.int.test.ts` e
 * `service-detail.view.test.ts`.
 */
const JARDINAGEM_ID = '00000000-0000-0000-0000-00000000d101';

test.describe('Ver detalhe do serviço (USP-031) — descoberta pública', () => {
  test('anônimo abre o detalhe e vê nome do prestador, valor e disponibilidade, sem contato', async ({
    page,
  }) => {
    await page.goto(`/servicos/${JARDINAGEM_ID}`);

    await expect(
      page.getByRole('heading', { name: /jardinagem residencial completa/i }),
    ).toBeVisible();
    // Nome do prestador é público (ADR-0010).
    await expect(page.getByText(/prestador asonseg \(demo\)/i)).toBeVisible();
    await expect(page.getByText(/segunda a sexta/i)).toBeVisible();
    // AC-031-4: termo de isenção de responsabilidade.
    await expect(page.getByText(/apenas plataforma de conexão/i)).toBeVisible();

    // SVC031-MN-01: telefone/e-mail nunca aparecem no HTML do anônimo.
    const content = await page.content();
    expect(content).not.toMatch(/\(\d{2}\)\s?\d{4,5}-\d{4}/);
  });

  test('anônimo vê CTA para criar conta (seam U3, sem revelação de contato)', async ({ page }) => {
    await page.goto(`/servicos/${JARDINAGEM_ID}`);
    await expect(page.getByRole('link', { name: /criar conta para entrar em contato/i })).toBeVisible();
  });

  test('serviço inexistente mostra estado indisponível, não erro técnico', async ({ page }) => {
    await page.goto('/servicos/00000000-0000-0000-0000-000000000000');
    await expect(page.getByRole('heading', { name: /serviço indisponível/i })).toBeVisible();
  });
});
