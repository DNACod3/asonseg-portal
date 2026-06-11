import { test, expect } from '@playwright/test';

/**
 * E2E de "Cadastro de prestador de serviço PF" (USP-010 — #110/#112/#114/#116).
 * A rota `(app)/prestador` é autenticada: ativar o papel e registrar o perfil
 * opera **exclusivamente** sobre a Pessoa da sessão (P-005), então o gate de
 * sessão é a garantia que só o E2E fecha ponta-a-ponta (middleware de borda +
 * `requireActivePerson` no layout `(app)`).
 *
 * Decisão de pirâmide de testes (mesma de `e2e/candidato.spec.ts`,
 * `e2e/ativar-papel.spec.ts`, `e2e/consentimentos.spec.ts` e `e2e/login.spec.ts`):
 * o fluxo autenticado completo — copy "agora você OFERECE serviços" (P-004),
 * aceitar o termo SERVICE_OFFERING, ativar o papel imediatamente sem moderação
 * (E-001, ADR-0015), criar o perfil em DRAFT, redirect MEI → USP-012 (E-002,
 * ADR-0031) e CTA "publicar primeiro serviço" (E-003) — é verificado de forma
 * autoritativa, sem semear sessão Supabase nem esbarrar no rate limit anônimo, em:
 *   - `src/modules/persons/__tests__/ProviderForm.test.tsx` (UI do formulário + gate de consentimento),
 *   - `src/modules/persons/__tests__/provider-schema.test.ts` (Zod + domínio),
 *   - `src/modules/persons/__tests__/provider-actions.test.ts` (action + ramos),
 *   - `src/modules/persons/__tests__/provider-actions.int.test.ts` (action + Postgres real).
 * USP-010 não é um dos Top 8 fluxos críticos (architecture-document §6). Aqui
 * travamos o que só o E2E garante: o confinamento da rota.
 */

test.describe('Cadastro de prestador de serviço PF (USP-010)', () => {
  test('rota autenticada: acesso sem sessão redireciona para /login', async ({ page }) => {
    await page.goto('/prestador');
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.locator('h1')).toContainText('Entrar');
  });
});
