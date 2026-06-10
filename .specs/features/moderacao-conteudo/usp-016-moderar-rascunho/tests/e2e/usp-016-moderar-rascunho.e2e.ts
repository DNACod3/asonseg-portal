// .specs/features/moderacao-conteudo/usp-016-moderar-rascunho/tests/e2e/usp-016-moderar-rascunho.e2e.ts
// FACT E2E (red) — USP-016, parte do Top 8 "publicar vaga + moderar" (architecture-document §6).
// Status: test.fixme — habilitar na fase Execute, quando a fila e as actions existirem.
// Na fase Execute, mover para: e2e/moderacao/moderar-rascunho.e2e.ts

import { test, expect } from '@playwright/test';

test.describe('USP-016 — Moderar rascunho (E2E, Top 8)', () => {
  test.fixme('coordenador aprova, devolve e rejeita rascunhos na fila', async ({ page }) => {
    // Pré-condição: seed com 3 rascunhos IN_MODERATION (vaga/CV/serviço) e um coordenador com permissão.

    // E-001 — abre a fila ordenada por data
    await page.goto('/moderacao');
    await expect(page.getByRole('heading', { name: /fila de moderação/i })).toBeVisible();
    // primeiro item = mais antigo

    // E-002 — aprovar
    await page.getByRole('button', { name: /aprovar/i }).first().click();
    await expect(page.getByText(/aprovad/i)).toBeVisible();

    // E-003 — devolver para ajustes exige motivo (P-003: ≥20 chars)
    await page.getByRole('button', { name: /devolver/i }).first().click();
    await page.getByLabel(/motivo/i).fill('x');
    await page.getByRole('button', { name: /confirmar/i }).click();
    await expect(page.getByText(/ao menos 20 caracteres/i)).toBeVisible();
    await page.getByLabel(/motivo/i).fill('Faltou descrever as atividades exercidas no cargo anterior');
    await page.getByRole('button', { name: /confirmar/i }).click();
    await expect(page.getByText(/devolvid/i)).toBeVisible();

    // E-004 — rejeitar com motivo
    await page.getByRole('button', { name: /rejeitar/i }).first().click();
    await page.getByLabel(/motivo/i).fill('Serviço não compatível com as diretrizes do portal');
    await page.getByRole('button', { name: /confirmar/i }).click();
    await expect(page.getByText(/rejeitad/i)).toBeVisible();
  });
});
