// .specs/features/vagas/usp-020-publicar-vaga/tests/e2e/usp-020-publicar-vaga.e2e.ts
// FACTS E2E (red) — mover para e2e/jobs/ na fase Execute (#165).
// Top-flow #3 (architecture-document §6): "publicar vaga → moderar → buscar → candidatar".
// Esta US cobre só a PRIMEIRA perna (publicar → em moderação); moderar/buscar/candidatar = USP-016/021/025.
// Marcados test.fixme para não quebrar a suite de CI até a implementação.
import { test, expect } from '@playwright/test';

test.describe('USP-020 — Publicar vaga (rota autenticada de Empresa)', () => {
  // --- confinamento da rota (o que só o E2E garante) ---
  test.fixme('rota autenticada: acesso sem sessão redireciona para /login', async ({ page }) => {
    await page.goto('/empresa/uuid-empresa/vagas/nova');
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  // --- E-001: submissão válida → em moderação ---
  test.fixme('E-001 — responsável publica vaga válida e ela vai para moderação', async ({ page }) => {
    // Autenticado como responsável ATIVO da Empresa
    await page.goto('/empresa/uuid-empresa/vagas/nova');
    await page.getByLabel(/título/i).fill('Atendente de balcão');
    await page.getByLabel(/área/i).selectOption({ label: 'Atendimento' });
    await page.getByLabel(/descrição/i).fill('Atendimento ao cliente no balcão.');
    await page.getByLabel(/requisitos/i).fill('Ensino médio completo.');
    await page.getByLabel(/regime/i).fill('CLT');
    await page.getByLabel(/local/i).fill('São Paulo - SP');
    await page.getByLabel(/validade/i).fill('2026-09-01');
    await page.getByRole('button', { name: /enviar para moderação/i }).click();
    await expect(page.getByText(/vaga enviada para moderação/i)).toBeVisible();
  });

  // --- E-003: salvar rascunho ---
  test.fixme('E-003 — responsável salva rascunho sem submeter', async ({ page }) => {
    await page.goto('/empresa/uuid-empresa/vagas/nova');
    await page.getByLabel(/título/i).fill('Rascunho de vaga');
    await page.getByRole('button', { name: /salvar rascunho/i }).click();
    await expect(page.getByText(/rascunho salvo/i)).toBeVisible();
  });

  // --- E-004: validade passada bloqueia ---
  test.fixme('E-004 — validade no passado bloqueia o submit com mensagem clara', async ({ page }) => {
    await page.goto('/empresa/uuid-empresa/vagas/nova');
    await page.getByLabel(/título/i).fill('Atendente');
    await page.getByLabel(/área/i).selectOption({ label: 'Atendimento' });
    await page.getByLabel(/descrição/i).fill('x');
    await page.getByLabel(/requisitos/i).fill('y');
    await page.getByLabel(/regime/i).fill('CLT');
    await page.getByLabel(/local/i).fill('SP');
    await page.getByLabel(/validade/i).fill('2026-06-10');
    await page.getByRole('button', { name: /enviar para moderação/i }).click();
    await expect(page.getByText(/validade.*futura/i)).toBeVisible();
  });

  // --- E-005: validade além do teto bloqueia ---
  test.fixme('E-005 — validade além de 180 dias bloqueia o submit', async ({ page }) => {
    await page.goto('/empresa/uuid-empresa/vagas/nova');
    await page.getByLabel(/validade/i).fill('2027-06-16');
    await page.getByRole('button', { name: /enviar para moderação/i }).click();
    await expect(page.getByText(/180 dias/i)).toBeVisible();
  });

  // --- P-006: só Empresas das quais é responsável aparecem ---
  test.fixme('P-006 — só Empresas com vínculo de responsável ativo aparecem como opção', async ({ page }) => {
    await page.goto('/empresa/uuid-empresa-sem-vinculo/vagas/nova');
    // acesso negado / Empresa não listada para publicação
    await expect(page.getByText(/não é responsável/i)).toBeVisible();
  });
});
