import { test, expect } from '@playwright/test';

/**
 * E2E de "Cadastro de candidato" (USP-009 — #31/#46). A rota `(app)/candidato`
 * é autenticada: ativar o papel e preencher o perfil opera **exclusivamente**
 * sobre a Pessoa da sessão (P-002), então o gate de sessão é a garantia que só o
 * E2E fecha ponta-a-ponta (middleware de borda + `requireActivePerson` no layout
 * `(app)`).
 *
 * Decisão de pirâmide de testes (mesma de `e2e/ativar-papel.spec.ts`,
 * `e2e/consentimentos.spec.ts` e `e2e/login.spec.ts`): o fluxo autenticado
 * completo — preencher escolaridade/área/telefone, aceitar o termo JOB_APPLICATION
 * (CAD-05), criar o perfil em DRAFT (CAD-01) e enviar para moderação
 * (CAD-03, DRAFT→IN_MODERATION) — é verificado de forma autoritativa, sem semear
 * sessão Supabase nem esbarrar no rate limit anônimo, em:
 *   - `src/modules/persons/__tests__/CandidateForm.test.tsx` (UI do formulário + gate de consentimento),
 *   - `src/modules/persons/__tests__/candidate-schema.test.ts` (Zod + domínio),
 *   - `src/modules/persons/__tests__/candidate-actions.int.test.ts` (actions + ramos, Postgres real).
 * USP-009 não é um dos Top 8 fluxos críticos (architecture-document §6). Aqui
 * travamos o que só o E2E garante: o confinamento da rota.
 */

test.describe('Cadastro de candidato (USP-009)', () => {
  test('rota autenticada: acesso sem sessão redireciona para /login', async ({ page }) => {
    await page.goto('/candidato');
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.locator('h1')).toContainText('Entrar');
  });
});
