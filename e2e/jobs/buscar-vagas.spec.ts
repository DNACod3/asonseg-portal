import { test, expect } from '@playwright/test';

/**
 * E2E da busca pública de vagas (USP-021 — #171). Top-flow de descoberta: o
 * visitante anônimo abre `/vagas`, vê vagas ACTIVE anonimizadas, filtra e busca.
 *
 * Depende das vagas de seed (`prisma/seed.ts` — Empresa "Lojas Guadalupe (demo)"
 * verificada, 4 vagas ACTIVE). O que só o E2E garante, travado aqui:
 *  - a rota pública renderiza as vagas sem sessão;
 *  - (D-002/E-004/P-001) o nome real da Empresa NÃO aparece no HTML do anônimo;
 *  - a busca textual sem acento e os filtros funcionam ponta-a-ponta.
 * As regras de recorte por papel/on-read são verificadas de forma autoritativa em
 * `src/modules/jobs/__tests__/search-jobs.int.test.ts` e `job-list-item.view.spec.ts`.
 */
test.describe('Buscar vagas (USP-021) — descoberta pública', () => {
  test('anônimo abre /vagas e vê vagas anonimizadas (sem nome real da Empresa)', async ({
    page,
  }) => {
    await page.goto('/vagas');

    await expect(page.getByRole('heading', { name: /vagas de emprego/i })).toBeVisible();
    // Empresa anonimizada por setor (E-004/P-001).
    await expect(page.getByText(/Empresa do setor de/i).first()).toBeVisible();
    // (D-002) o nome real da Empresa de seed jamais chega ao HTML do anônimo.
    expect(await page.content()).not.toContain('Lojas Guadalupe');
  });

  test('@e-003 busca textual sem acento encontra a vaga', async ({ page }) => {
    await page.goto('/vagas');
    // "padária" (com acento) deve casar a vaga "Atendente de padaria" (sem acento).
    await page.getByLabel('Buscar vaga').fill('padária');
    await page.getByRole('button', { name: 'Filtrar' }).click();

    await expect(page).toHaveURL(/[?&]q=pad/i);
    await expect(page.getByRole('heading', { name: /padaria/i })).toBeVisible();
  });

  test('@e-002 filtro por área reduz a lista', async ({ page }) => {
    await page.goto('/vagas');
    await page.getByLabel('Área').selectOption({ label: 'Alimentação e Gastronomia' });
    await page.getByRole('button', { name: 'Filtrar' }).click();

    // Só a vaga de alimentação (padaria) permanece; a de comércio (vendedor) some.
    await expect(page.getByRole('heading', { name: /padaria/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /vendedor/i })).toHaveCount(0);
  });

  test('estado vazio quando nada casa a busca', async ({ page }) => {
    await page.goto('/vagas?q=zzxxqqnaoexiste');
    await expect(page.getByText(/nenhuma vaga encontrada/i).first()).toBeVisible();
  });
});
