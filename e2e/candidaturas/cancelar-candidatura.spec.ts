import { test, expect } from '@playwright/test';

/**
 * E2E de "Cancelar candidatura" (USP-026 — CAN-02/CAN-026-03). O CTA de
 * cancelar mora no mesmo slot do CTA de candidatar-se (USP-025) em
 * `/vagas/[id]` — rota PÚBLICA, sem gate de sessão.
 *
 * **Decisão de pirâmide de testes (SPEC_DEVIATION documentado — mesma decisão
 * de `e2e/candidaturas/candidatar-se.spec.ts`, `e2e/candidato.spec.ts`,
 * `e2e/companies/editar-empresa.spec.ts`, `e2e/moderacao/moderar-rascunho.spec.ts`):**
 * o projeto não semeia sessão Supabase no E2E. O caminho autenticado completo —
 * cancelar preenche `cancelledAt` + audita + libera recandidatura, restrito ao
 * dono (candidatura de terceiro → `NOT_FOUND`), idempotente sob concorrência —
 * é verificado de forma autoritativa, ponta-a-ponta contra Postgres real, em:
 *   - `src/modules/jobs/__tests__/cancel-application.int.test.ts` (action completa + corrida + recandidatura),
 *   - `src/modules/jobs/__tests__/cancel-application-button.spec.tsx` (estados de clique do botão),
 *   - `src/modules/jobs/__tests__/job-detail.spec.tsx` (troca de estado por `myApplicationId`).
 * Sem sessão, o visitante nunca vê candidatura ativa — logo nunca vê o CTA de
 * cancelar. O que o E2E garante aqui, sem sessão, é que essa ausência se sustenta
 * mesmo na mesma vaga usada pelo teste de candidatar-se (regressão de wiring).
 */

const JOB_COM_CONTADOR = '00000000-0000-0000-0000-00000000d002'; // Vendedor(a) — seed demo, vaga ACTIVE

test.describe('Cancelar candidatura (USP-026) — visitante anônimo', () => {
  test('@ac-can-026-03 sem sessão: nenhum botão "Cancelar candidatura" na vaga', async ({ page }) => {
    await page.goto(`/vagas/${JOB_COM_CONTADOR}`);

    await expect(page.getByRole('heading', { name: /vendedor/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancelar candidatura/i })).toHaveCount(0);
    await expect(page.getByText(/você já se candidatou/i)).toHaveCount(0);
  });
});
