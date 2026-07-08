// .specs/features/vagas/usp-024-expiracao-automatica/tests/e2e/usp-024-expiracao-automatica.e2e.ts
// FACT E2E (red) — mover para e2e/jobs/ na fase Execute (T5).
// Não é um dos Top 8 fluxos críticos por si (architecture-document §6); o único ensaio de UI
// desta US é o badge "expira em N dias" no painel de gestão de vagas introduzido pela USP-023
// (E-004/P-003 — sinal in-portal que não depende do e-mail). Marcado test.fixme até a UI existir.
import { test, expect } from '@playwright/test';

test.describe('USP-024 — Badge de expiração no painel de gestão (USP-023)', () => {
  test.fixme('@e-004 @p-003 — vaga ACTIVE próxima da validade mostra "expira em N dias" no painel', async ({ page }) => {
    await page.goto('/empresa/empresa-1/vagas');
    await expect(page.getByText(/expira em \d+ dias?/i)).toBeVisible();
  });
});
