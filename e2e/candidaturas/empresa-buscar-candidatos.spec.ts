import { test, expect } from '@playwright/test';

/**
 * E2E de "Empresa buscar candidatos — busca ativa" (USP-028 — CAN-04).
 *
 * **Decisão de pirâmide de testes (SPEC_DEVIATION documentado — mesma decisão de
 * `e2e/candidaturas/empresa-ver-candidatos.spec.ts`, `e2e/jobs/usp-023-editar-vaga.spec.ts`,
 * `e2e/candidaturas/candidatar-se.spec.ts`):** o projeto **não semeia sessão
 * Supabase de responsável de Empresa no E2E**. `empresa/[empresaId]/candidatos`
 * é uma rota `(app)` autenticada restrita ao responsável ATIVO da Empresa
 * (P-005/D-005) — por isso o E2E aqui trava o que só ele garante ponta-a-ponta:
 * o gate de sessão (middleware, ADR-0030) da rota nova.
 *
 * O caminho autenticado completo é verificado de forma autoritativa em:
 *   - `src/modules/persons/__tests__/search-candidates.int.test.ts` (gate
 *     ACTIVE/ATIVO, cada filtro + combinação AND, busca sem acento, paginação
 *     no banco, authz, estado vazio, sensor de discriminação de PII/sobrenome
 *     ausente do payload — USP028-MN-01..05, contra Postgres real),
 *   - `src/app/(app)/empresa/[empresaId]/candidatos/page.test.tsx` (gate de
 *     rota: não-responsável → 404 sem executar a busca; happy path; estado
 *     vazio — mockado, sem depender de sessão real),
 *   - `src/modules/persons/__tests__/candidate-search-list.test.tsx`
 *     (renderização do View Model: primeiro nome, localização, escolaridade, resumo).
 *
 * O seed demo (`prisma/seeds/demo.ts` → `seedDemoCandidateProfiles`) popula 2
 * candidatos ACTIVE com `regionId` para o dia em que a sessão de responsável
 * for semeada no E2E (T6 — "Done when" da task) — hoje o gate barra antes
 * de qualquer render de resultado.
 */

const EMPRESA_QUALQUER = '00000000-0000-0000-0000-000000000000';

test.describe('Empresa buscar candidatos (USP-028) — gate de sessão da rota', () => {
  test('@ac-usp028-01 sem sessão: acesso à busca de candidatos redireciona para /login', async ({
    page,
  }) => {
    await page.goto(`/empresa/${EMPRESA_QUALQUER}/candidatos`);
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test('@ac-usp028-01 sem sessão: acesso com filtros na URL também redireciona para /login (gate roda antes de ler searchParams)', async ({
    page,
  }) => {
    await page.goto(`/empresa/${EMPRESA_QUALQUER}/candidatos?q=vendas&escolaridade=ENSINO_MEDIO`);
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
