import { test, expect } from '@playwright/test';

/**
 * E2E da busca pública de serviços (USP-030). Top-flow de descoberta: o
 * visitante anônimo abre `/servicos`, vê serviços ACTIVE, filtra e busca.
 *
 * Depende dos serviços de seed (`prisma/seeds/demo.ts` — Prestador "Prestador
 * ASONSEG (demo)", 2 serviços ACTIVE + 1 PAUSED). O que só o E2E garante,
 * travado aqui:
 *  - a rota pública renderiza os serviços sem sessão;
 *  - o serviço PAUSED de demo NÃO aparece na busca pública (SVC030-MN-01);
 *  - a busca textual sem acento e os filtros funcionam ponta-a-ponta;
 *  - o termo de isenção de responsabilidade da ASONSEG é exibido (AC-030-4).
 * As regras de recorte/anonimização são verificadas de forma autoritativa em
 * `src/modules/services/__tests__/search-services.int.test.ts` e
 * `service-list-item.view.test.ts`.
 */
test.describe('Buscar serviços (USP-030) — descoberta pública', () => {
  test('anônimo abre /servicos e vê serviços ativos com nome do prestador público', async ({
    page,
  }) => {
    await page.goto('/servicos');

    await expect(page.getByRole('heading', { name: 'Serviços', level: 1 })).toBeVisible();
    // Nome do prestador é público (ADR-0010) — diferença chave vs vagas.
    await expect(page.getByText(/prestador asonseg \(demo\)/i).first()).toBeVisible();
    // AC-030-4: termo de isenção de responsabilidade da ASONSEG.
    await expect(page.getByText(/apenas plataforma de conexão/i)).toBeVisible();
  });

  test('SVC030-MN-01: serviço pausado de demo não aparece na busca pública', async ({ page }) => {
    await page.goto('/servicos');
    expect(await page.content()).not.toContain('Encanador (serviço pausado');
  });

  test('AC-030-3 busca textual sem acento encontra o serviço', async ({ page }) => {
    await page.goto('/servicos');
    // "jardinágem" (com acento incorreto) deve casar "Jardinagem residencial completa".
    await page.getByLabel('Buscar serviço').fill('jardinágem');
    await page.getByRole('button', { name: 'Filtrar' }).click();

    await expect(page).toHaveURL(/[?&]q=jard/i);
    await expect(page.getByRole('heading', { name: /jardinagem residencial/i })).toBeVisible();
  });

  test('AC-030-2 filtro por categoria reduz a lista', async ({ page }) => {
    await page.goto('/servicos');
    await page.getByLabel('Categoria').selectOption({ label: 'Aulas e Reforço' });
    await page.getByRole('button', { name: 'Filtrar' }).click();

    // `seeds/bulk.ts` cria 'Aulas de Reforço (Fundamental)' além do fixture de
    // demo, então o regex casa mais de um card e o modo estrito do Playwright
    // recusa o locator. O AC é "a lista reduziu para a categoria" — não
    // "existe exatamente 1 resultado", que dependeria do volume do seed.
    await expect(page.getByRole('heading', { name: /aulas de reforço/i }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /jardinagem residencial/i })).toHaveCount(0);
  });

  test('estado vazio quando nada casa a busca', async ({ page }) => {
    await page.goto('/servicos?q=zzxxqqnaoexiste');
    await expect(page.getByText(/nenhum serviço encontrado/i).first()).toBeVisible();
  });
});
