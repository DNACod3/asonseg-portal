// .specs/features/cadastros-publicos/usp-009-cadastro-candidato/tests/e2e/usp-009-cadastro-candidato.e2e.ts
// FACT E2E (red, de APOIO) — mover para e2e/ na fase Execute (#46).
// NOTA: USP-009 NÃO é um dos Top 8 fluxos críticos (architecture-document §6) — os críticos
// relacionados são USP-040 (upload+extração CV) e USP-016 (moderação). Este esqueleto cobre
// o caminho feliz da tela de cadastro como apoio; marcado test.fixme para não quebrar o CI.

import { test, expect } from '@playwright/test';

test.describe('USP-009 — Cadastro de candidato (apoio, não Top 8)', () => {
  test.fixme('CAD-01 — candidato preenche o formulário e ativa o papel em rascunho', async ({ page }) => {
    // pré: Pessoa autenticada (reusar storageState/login helper do e2e existente)
    await page.goto('/candidato');
    await page.getByLabel(/escolaridade/i).selectOption('ENSINO_MEDIO');
    await page.getByLabel(/área de interesse/i).fill('Administração');
    await page.getByLabel(/telefone/i).fill('(11) 98888-7777');
    await page.getByRole('checkbox', { name: /aceito.*portal_access|consentimento/i }).check();
    await page.getByRole('button', { name: /salvar|ativar|cadastrar/i }).click();
    await expect(page.getByText(/rascunho|perfil criado|cadastro realizado/i)).toBeVisible();
  });

  test.fixme('CAD-05 — botão de envio bloqueado sem aceite de consentimento', async ({ page }) => {
    await page.goto('/candidato');
    await page.getByLabel(/escolaridade/i).selectOption('ENSINO_MEDIO');
    await page.getByLabel(/área de interesse/i).fill('Administração');
    await page.getByLabel(/telefone/i).fill('(11) 98888-7777');
    // sem marcar o aceite de consentimento:
    await expect(page.getByRole('button', { name: /salvar|ativar|cadastrar/i })).toBeDisabled();
  });

  test.fixme('CAD-03 — enviar para moderação reflete status IN_MODERATION', async ({ page }) => {
    // transitionContent() disponível (módulo moderation, USP-016 mergeada).
    await page.goto('/candidato');
    await page.getByRole('button', { name: /enviar para moderação/i }).click();
    await expect(page.getByText(/em moderação/i)).toBeVisible();
  });
});
