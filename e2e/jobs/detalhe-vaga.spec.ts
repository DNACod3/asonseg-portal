import { test, expect } from '@playwright/test';

/**
 * E2E do detalhe público de vaga (USP-022 — #277). O visitante anônimo abre
 * `/vagas/[id]`, vê os dados completos com a Empresa anonimizada e, conforme o estado
 * da vaga, o contador de candidaturas ou a mensagem "vaga encerrada".
 *
 * Depende das vagas de seed (`prisma/seed.ts`): a Empresa "Lojas Guadalupe (demo)" é
 * verificada; a vaga "Vendedor(a) de loja" (d002) tem 4 candidaturas ativas (contador
 * visível, D-005) e "Atendente de padaria" (d001) tem 0 (contador oculto). As regras de
 * recorte por papel/on-read são verificadas de forma autoritativa em
 * `get-job-detail.int.test.ts` e `job-detail.view.spec.ts`.
 */

const JOB_COM_CONTADOR = '00000000-0000-0000-0000-00000000d002'; // Vendedor(a) — 4 candidaturas ativas
const JOB_SEM_CONTADOR = '00000000-0000-0000-0000-00000000d001'; // Atendente de padaria — 0 candidaturas
const JOB_INEXISTENTE = '00000000-0000-0000-0000-0000000000ff'; // não casa o on-read

test.describe('Detalhe da vaga (USP-022) — visitante anônimo', () => {
  test('abre o detalhe anonimizado, sem botão candidatar-se', async ({ page }) => {
    await page.goto(`/vagas/${JOB_COM_CONTADOR}`);

    await expect(page.getByRole('heading', { name: /vendedor/i })).toBeVisible();
    // Empresa anonimizada por setor (E-001/P-002).
    await expect(page.getByText(/Empresa do setor de/i)).toBeVisible();
    // (D-001) o nome real da Empresa de seed jamais chega ao HTML do anônimo.
    expect(await page.content()).not.toContain('Lojas Guadalupe');
    // Anônimo não vê o botão "candidatar-se" — vê o CTA de criar conta.
    await expect(page.getByRole('button', { name: /candidatar-se/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /criar conta para candidatar/i })).toBeVisible();
  });

  test('@e-003 @d-005 contador aparece só na vaga com ≥ 3 candidaturas', async ({ page }) => {
    await page.goto(`/vagas/${JOB_COM_CONTADOR}`);
    await expect(page.getByText(/\d+ pessoas se candidataram/i)).toBeVisible();

    await page.goto(`/vagas/${JOB_SEM_CONTADOR}`);
    await expect(page.getByRole('heading', { name: /padaria/i })).toBeVisible();
    await expect(page.getByText(/se candidat/i)).toHaveCount(0);
  });

  test('@e-005 @d-004 vaga indisponível por link direto mostra "vaga encerrada" + CTA lista', async ({
    page,
  }) => {
    await page.goto(`/vagas/${JOB_INEXISTENTE}`);

    await expect(page.getByRole('heading', { name: /vaga encerrada/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /ver outras vagas/i })).toBeVisible();
    // Sem botão candidatar-se num estado não-ativo (P-005).
    await expect(page.getByRole('button', { name: /candidatar-se/i })).toHaveCount(0);
  });

  test('navega da lista para o detalhe', async ({ page }) => {
    await page.goto('/vagas');
    await page.getByRole('heading', { name: /vendedor/i }).first().click();
    await expect(page).toHaveURL(/\/vagas\/[0-9a-f-]+/i);
    await expect(page.getByRole('link', { name: /voltar para as vagas/i })).toBeVisible();
  });
});
