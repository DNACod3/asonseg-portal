import { test, expect } from '@playwright/test';

/**
 * E2E de "Empresa ver lista de candidatos da vaga" (USP-027 — CAN-03).
 *
 * **Decisão de pirâmide de testes (SPEC_DEVIATION documentado — mesma decisão de
 * `e2e/jobs/usp-023-editar-vaga.spec.ts`, `e2e/candidaturas/candidatar-se.spec.ts`,
 * `e2e/companies/editar-empresa.spec.ts`, `e2e/companies/remove-responsible.spec.ts`,
 * `e2e/moderacao/moderar-rascunho.spec.ts`):** o projeto **não semeia sessão
 * Supabase de responsável de Empresa no E2E** (sem infra de session-seeding —
 * login real esbarra no rate limit anônimo e exigiria assinar token/cookie do
 * Supabase Auth fora do fluxo de UI). `empresa/[empresaId]/vagas/[jobId]/candidatos`
 * é uma rota `(app)` autenticada restrita ao responsável ATIVO da Empresa dona da
 * vaga (P-005/D-005) — por isso o E2E aqui trava o que só ele garante ponta-a-ponta:
 * o gate de sessão (middleware, ADR-0030) da rota nova.
 *
 * O caminho autenticado completo é verificado de forma autoritativa em:
 *   - `src/modules/jobs/__tests__/list-job-applicants.int.test.ts` (ownership,
 *     exclusão de canceladas, auditoria `APPLICATION_VIEWED_BY_EMPLOYER` +
 *     `SENSITIVE_FIELD_VIEWED`, sensor de discriminação de PII — CPF/endereço
 *     ausentes do payload — USP027-MN-01..05, contra Postgres real),
 *   - `src/app/(app)/empresa/[empresaId]/vagas/[jobId]/candidatos/page.test.tsx`
 *     (gate de rota: FORBIDDEN de outra Empresa e NOT_FOUND de vaga inexistente
 *     ambos → 404; happy path; estado vazio — mockado, sem depender de sessão real),
 *   - `src/modules/jobs/components/__tests__/job-applicants-list.test.tsx`
 *     (renderização do View Model: nome, contato, CV, badge de encaminhamento).
 */

const JOB_COM_CANDIDATOS = '00000000-0000-0000-0000-00000000d002'; // seed demo, vaga ACTIVE
const EMPRESA_QUALQUER = '00000000-0000-0000-0000-000000000000';
const JOB_QUALQUER = '00000000-0000-0000-0000-000000000000';

test.describe('Empresa ver candidatos da vaga (USP-027) — gate de sessão da rota', () => {
  test('@ac-usp027-01 sem sessão: acesso à lista de candidatos redireciona para /login', async ({
    page,
  }) => {
    await page.goto(`/empresa/${EMPRESA_QUALQUER}/vagas/${JOB_COM_CANDIDATOS}/candidatos`);
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test('@ac-usp027-06 sem sessão: acesso à vaga/Empresa de outrem também redireciona para /login (gate barra antes do 404 de ownership)', async ({
    page,
  }) => {
    await page.goto(`/empresa/${EMPRESA_QUALQUER}/vagas/${JOB_QUALQUER}/candidatos`);
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
