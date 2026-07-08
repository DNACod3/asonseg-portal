import { test, expect } from '@playwright/test';

/**
 * E2E de "Candidatar-se a uma vaga" (USP-025 — CAN-01/CAN-025-06). O CTA de
 * candidatura mora em `/vagas/[id]`, uma rota PÚBLICA (sem gate de sessão) — o
 * candidato ativo autenticado vê `<ApplyToJobButton>`; o anônimo vê o CTA de
 * criar conta (P-003/P-005, preservado da USP-022).
 *
 * **Decisão de pirâmide de testes (SPEC_DEVIATION documentado — mesma decisão de
 * `e2e/candidato.spec.ts`, `e2e/companies/editar-empresa.spec.ts`,
 * `e2e/moderacao/moderar-rascunho.spec.ts`, `e2e/companies/remove-responsible.spec.ts`):**
 * o projeto **não semeia sessão Supabase no E2E** (sem infra de session-seeding —
 * login real esbarra no rate limit anônimo e exigiria assinar token/cookie do
 * Supabase Auth fora do fluxo de UI). O caminho autenticado completo — candidatar
 * cria a `Application` + audita + enfileira o e-mail, bloqueia duplicata/vaga
 * fechada/perfil não-ativo/sem-consentimento, e a **corrida de concorrência**
 * (índice único parcial) — é verificado de forma autoritativa, ponta-a-ponta
 * contra Postgres real, em:
 *   - `src/modules/jobs/__tests__/apply-to-job.int.test.ts` (action completa + corrida),
 *   - `src/modules/jobs/__tests__/apply-to-job-button.spec.tsx` (estados de clique do botão),
 *   - `src/modules/jobs/__tests__/job-detail.spec.tsx` (troca de estado por `myApplicationId`).
 * Diferente das rotas `(app)` citadas acima, `/vagas/[id]` é pública — não há
 * redirect de gate a travar aqui. O que o E2E garante, sem sessão, é o contrato
 * que o visitante anônimo realmente vê no navegador: nenhum CTA de candidatura
 * ativo, e um caminho claro para criar conta antes de poder se candidatar.
 */

const JOB_COM_CONTADOR = '00000000-0000-0000-0000-00000000d002'; // Vendedor(a) — seed demo, vaga ACTIVE

test.describe('Candidatar-se a uma vaga (USP-025) — visitante anônimo', () => {
  test('@ac-can-025-06 sem sessão: nenhum botão "Candidatar-se"; CTA leva a criar conta', async ({
    page,
  }) => {
    await page.goto(`/vagas/${JOB_COM_CONTADOR}`);

    await expect(page.getByRole('heading', { name: /vendedor/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /candidatar-se/i })).toHaveCount(0);

    const criarConta = page.getByRole('link', { name: /criar conta para candidatar/i });
    await expect(criarConta).toBeVisible();
    await criarConta.click();
    await expect(page).toHaveURL(/\/cadastro/);
  });
});
