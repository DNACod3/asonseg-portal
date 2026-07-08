import { test, expect } from '@playwright/test';

/**
 * E2E de "Prestador ver manifestações de interesse" (USP-035 — AC-035-1). A
 * rota `(app)/prestador/manifestacoes` é autenticada com guard de papel
 * `PROVIDER`: só a Pessoa da sessão vê o próprio inbox de manifestações
 * (P-005), então o gate de sessão é a garantia que só o E2E fecha
 * ponta-a-ponta (middleware de borda + `requireActivePerson` no layout `(app)`).
 *
 * Decisão de pirâmide de testes (mesma de `e2e/prestador.spec.ts`,
 * `e2e/candidato.spec.ts`, `e2e/ativar-papel.spec.ts`): o projeto **não semeia
 * sessão Supabase no E2E**. O caminho autenticado completo — inbox agregado
 * ordenado por data, escopo por `authorPersonId` (SVC035-MN-01), exclusão de
 * canceladas (SVC035-MN-03), payload sem PII extra (SVC035-MN-02) e a
 * auditoria `SENSITIVE_FIELD_VIEWED` — é verificado de forma autoritativa,
 * ponta-a-ponta contra Postgres real, em:
 *   - `src/modules/services/__tests__/list-provider-interests.int.test.ts` (query completa),
 *   - `src/app/(app)/prestador/manifestacoes/page.test.tsx` (guard 404, L-008).
 * USP-035 não é um dos Top 8 fluxos críticos (architecture-document §6). Aqui
 * travamos o que só o E2E garante: o confinamento da rota.
 */

test.describe('Prestador ver manifestações de interesse (USP-035)', () => {
  test('rota autenticada: acesso sem sessão redireciona para /login', async ({ page }) => {
    await page.goto('/prestador/manifestacoes');
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.locator('h1')).toContainText('Entrar');
  });
});
