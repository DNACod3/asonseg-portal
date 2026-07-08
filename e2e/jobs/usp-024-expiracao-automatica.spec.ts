import { test, expect } from '@playwright/test';

/**
 * E2E de "Expiração automática de vaga" (USP-024). Promovido do esqueleto
 * `test.fixme` de `.specs/features/vagas/usp-024-expiracao-automatica/tests/e2e/`
 * (skill-tdad, T0) — Fix 1 (Blocker, compartilhado com a USP-023) da validação:
 * o arquivo `.fixme` nunca chegava ao `test:e2e` do CI.
 *
 * O esqueleto original mirava o badge "expira em N dias" no painel de gestão —
 * mas esse painel é uma rota autenticada (`(app)/empresa/[empresaId]/vagas`) e o
 * projeto ainda não semeia sessão de responsável de Empresa no E2E (mesma decisão
 * documentada em `e2e/jobs/usp-023-editar-vaga.spec.ts`). O cálculo puro do badge
 * (`diasAteExpiracao`) e sua projeção (`viewCompanyJobRow`) já são cobertos
 * exaustivamente por `src/modules/jobs/__tests__/validade.spec.ts` e
 * `company-job-row.view.spec.ts`.
 *
 * O que ESTE E2E trava — a consequência pública da expiração, que não depende do
 * cron ter rodado nem de sessão nenhuma (P-001, defesa on-read) — usa a fixture de
 * seed `d006` (`prisma/seeds/demo.ts`, status `EXPIRED`, `validUntil` no passado):
 * a vaga expirada não aparece na busca pública (`/vagas`) e o link direto ao
 * detalhe mostra "vaga encerrada", sem botão candidatar-se. Mesma decisão de
 * pirâmide de `e2e/jobs/buscar-vagas.spec.ts` e `e2e/jobs/detalhe-vaga.spec.ts`
 * (USP-021/022): rotas públicas, sem sessão. O caso "job ACTIVE porém vencido, cron
 * não rodou" (mesma defesa on-read, ramo diferente de origem) é verificado
 * autoritativamente contra Postgres real em
 * `src/modules/jobs/__tests__/expired-on-read.int.test.ts`; a idempotência e o
 * `JOB_EXPIRED` do próprio job periódico em `run-job-expiration.int.test.ts`.
 */

const JOB_EXPIRADO = '00000000-0000-0000-0000-00000000d006'; // seed: EXPIRED (demo.ts)

test.describe('Expiração automática de vaga (USP-024) — consequência pública', () => {
  test('@p-001 — vaga expirada não aparece na busca pública', async ({ page }) => {
    await page.goto('/vagas');
    await expect(page.getByText('Estoquista (vaga expirada — demo)')).toHaveCount(0);
  });

  test('@p-001 @p-004 — link direto de vaga expirada mostra "vaga encerrada", sem botão candidatar', async ({
    page,
  }) => {
    await page.goto(`/vagas/${JOB_EXPIRADO}`);

    await expect(page.getByRole('heading', { name: /vaga encerrada/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /candidatar-se/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /ver outras vagas/i })).toBeVisible();
  });
});
