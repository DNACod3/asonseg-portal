import { test, expect } from '@playwright/test';

/**
 * E2E de "Editar vaga (pausar, arquivar, renovar)" (USP-023). Promovido do
 * esqueleto `test.fixme` de `.specs/features/vagas/usp-023-editar-vaga/tests/e2e/`
 * (skill-tdad, T0) — mover para cá era o Fix 1 (Blocker) apontado pela validação:
 * os arquivos .fixme nunca chegavam ao `test:e2e` do CI, então a superfície
 * Rota/UI da USP-023 tinha zero cobertura executável.
 *
 * Decisão de pirâmide de testes: o painel de gestão (`(app)/empresa/[empresaId]/vagas`)
 * e a edição (`.../vagas/[jobId]/editar`) são rotas autenticadas restritas ao
 * responsável ATIVO da Empresa (P-005/D-005). O projeto ainda não semeia sessão de
 * responsável de Empresa no E2E (mesma decisão de `e2e/companies/editar-empresa.spec.ts`,
 * `e2e/companies/responsaveis.spec.ts` e `e2e/jobs/publicar-vaga.spec.ts`) — por isso
 * o E2E aqui trava o que só ele garante ponta-a-ponta: o gate de sessão (middleware +
 * `requireActivePerson`, ADR-0030) das duas rotas novas. O confinamento por dono
 * (`notFound()` p/ não-responsável ou Empresa/vaga alheia) é verificado
 * autoritativamente, mockando sessão/Prisma, em
 * `src/app/(app)/empresa/[empresaId]/vagas/page.test.tsx` e
 * `src/app/(app)/empresa/[empresaId]/vagas/[jobId]/editar/page.test.tsx`. O ciclo de
 * vida completo (editar→rascunho→moderação, pausar/despausar, arquivar com
 * terminalidade, prorrogar validade) é verificado autoritativamente contra Postgres
 * real em:
 *   - `src/modules/jobs/__tests__/edit-job.int.test.ts` (E-001/E-005/P-001),
 *   - `src/modules/jobs/__tests__/pause-job.int.test.ts` (E-002/P-005),
 *   - `src/modules/jobs/__tests__/archive-job.int.test.ts` (E-003/P-006),
 *   - `src/modules/jobs/__tests__/extend-job-validity.int.test.ts` (E-004).
 *
 * O detalhe de vaga PAUSED (T7/P-003), por outro lado, é servido pela rota PÚBLICA
 * `/vagas/[id]` (sem sessão) — por isso o E2E fecha esse ramo ponta-a-ponta usando a
 * fixture de seed `d005` (`prisma/seeds/demo.ts`), a mesma decisão de pirâmide de
 * `e2e/jobs/detalhe-vaga.spec.ts` (USP-022).
 */

const JOB_PAUSADO = '00000000-0000-0000-0000-00000000d005'; // seed: PAUSED (demo.ts)

test.describe('Editar vaga (USP-023) — detalhe público de vaga pausada (P-003)', () => {
  test('@ac-023-2 @p-003 — detalhe de vaga pausada mostra mensagem, sem botão candidatar', async ({
    page,
  }) => {
    await page.goto(`/vagas/${JOB_PAUSADO}`);

    await expect(page.getByRole('heading', { name: /temporariamente pausada/i })).toBeVisible();
    // P-003 (negative test): a página não renderiza `JobDetailView` nesse ramo, logo
    // não há CTA de candidatura algum — garantido por construção, travado aqui.
    await expect(page.getByRole('button', { name: /candidatar-se/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /ver outras vagas/i })).toBeVisible();
  });
});

test.describe('Editar vaga (USP-023) — gate de rota das páginas de gestão', () => {
  test('@painel rota autenticada: acesso sem sessão redireciona para /login', async ({ page }) => {
    await page.goto('/empresa/00000000-0000-0000-0000-000000000000/vagas');
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test('@ac-023-1 rota de edição autenticada: acesso sem sessão redireciona para /login', async ({
    page,
  }) => {
    await page.goto(
      '/empresa/00000000-0000-0000-0000-000000000000/vagas/00000000-0000-0000-0000-000000000000/editar',
    );
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
