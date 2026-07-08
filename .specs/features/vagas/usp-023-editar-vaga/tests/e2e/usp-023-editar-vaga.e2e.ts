// .specs/features/vagas/usp-023-editar-vaga/tests/e2e/usp-023-editar-vaga.e2e.ts
// FACTS E2E (red) — mover para e2e/jobs/ na fase Execute (T7-T9 / PR-B).
// Cobre a superfície de gestão (app)/empresa/[empresaId]/vagas: lista, confinamento P-005,
// detalhe de vaga pausada (P-003) e o fluxo editar→rascunho→moderação (D-001/D-002 do intent).
// Marcados test.fixme para não quebrar a suite de CI até a implementação.
import { test, expect } from '@playwright/test';

test.describe('USP-023 — Gestão de vagas da Empresa (painel autenticado)', () => {
  test.fixme('@painel — responsável vê lista de vagas com ações por status', async ({ page }) => {
    await page.goto('/empresa/empresa-1/vagas');
    await expect(page.getByRole('heading', { name: /minhas vagas/i })).toBeVisible();
  });

  test.fixme('@painel @p-005 — não-responsável recebe 404 ao abrir o painel de outra Empresa', async ({ page }) => {
    await page.goto('/empresa/empresa-de-outra-org/vagas');
    await expect(page.getByText(/página não encontrada/i)).toBeVisible();
  });

  test.fixme('@ac-023-1 — editar vaga encadeia editJob → submitJobForModeration', async ({ page }) => {
    await page.goto('/empresa/empresa-1/vagas/job-1/editar');
    await page.getByLabel('Descrição').fill('Descrição corrigida');
    await page.getByRole('button', { name: /salvar/i }).click();
    await expect(page.getByText(/enviada para moderação/i)).toBeVisible();
  });

  test.fixme('@ac-023-2 — pausar vaga some da busca e despausar traz de volta', async ({ page }) => {
    await page.goto('/empresa/empresa-1/vagas');
    await page.getByRole('button', { name: /pausar/i }).first().click();
    await expect(page.getByText(/pausada/i)).toBeVisible();
    await page.goto('/vagas');
    await expect(page.getByText('Vaga Pausada Teste')).toHaveCount(0);
  });

  test.fixme('@ac-023-2 @p-003 — detalhe de vaga pausada mostra mensagem, sem botão candidatar', async ({ page }) => {
    await page.goto('/vagas/job-pausada-1');
    await expect(page.getByText(/temporariamente pausada/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /candidatar/i })).toHaveCount(0);
  });

  test.fixme('@ac-023-3 — arquivar exige confirmação (padrão EditCompanyForm)', async ({ page }) => {
    await page.goto('/empresa/empresa-1/vagas');
    await page.getByRole('button', { name: /arquivar/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /confirmar/i }).click();
    await expect(page.getByText(/arquivada/i)).toBeVisible();
  });

  test.fixme('@ac-023-4 — prorrogar validade sem sair de ACTIVE', async ({ page }) => {
    await page.goto('/empresa/empresa-1/vagas');
    await page.getByRole('button', { name: /prorrogar/i }).first().click();
    await expect(page.getByText(/validade atualizada/i)).toBeVisible();
  });
});
