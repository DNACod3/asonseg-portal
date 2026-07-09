import { test, expect } from '@playwright/test';

/**
 * E2E do gate de sessão do CTA de manifestação de interesse (USP-033 —
 * AC-033-1). O CTA mora em `/servicos/[id]`, uma rota PÚBLICA (sem gate de
 * sessão) — o cliente ativo autenticado vê `<ManifestInterestButton>`; o
 * anônimo vê o CTA de criar conta (mesma decisão de `e2e/candidaturas/candidatar-se.spec.ts`
 * para a analogia de vagas).
 *
 * **Decisão de pirâmide de testes (SPEC_DEVIATION documentado — mesma decisão
 * de `e2e/candidaturas/candidatar-se.spec.ts`, `e2e/prestador.spec.ts`,
 * `e2e/candidato.spec.ts`):** o projeto **não semeia sessão Supabase no E2E**
 * (sem infra de session-seeding). O caminho autenticado completo — manifestar
 * interesse persiste + ativa o papel CLIENT + revela contato + audita + enfileira
 * e-mail, bloqueia auto-manifestação/serviço fechado/consentimento ausente, e a
 * **corrida de concorrência** (índice único parcial) — é verificado de forma
 * autoritativa, ponta-a-ponta contra Postgres real, em:
 *   - `src/modules/services/__tests__/manifest-interest.int.test.ts` (action completa + corrida),
 *   - `src/modules/services/__tests__/manifest-interest-button.spec.tsx` (estados de clique do botão),
 *   - `src/modules/services/__tests__/service-detail-cta.test.tsx` (troca de estado por myInterestId/providerContact).
 * O que este E2E garante, sem sessão, é o contrato que o visitante anônimo
 * realmente vê no navegador: nenhum CTA de manifestação ativo, e um caminho
 * claro para criar conta antes de poder entrar em contato.
 */

const JARDINAGEM_ID = '00000000-0000-0000-0000-00000000d101'; // seed demo, serviço ACTIVE

test.describe('Manifestar interesse em serviço (USP-033) — visitante anônimo', () => {
  test('@ac-033-1 sem sessão: nenhum botão "Entrar em contato"; CTA leva a criar conta', async ({ page }) => {
    await page.goto(`/servicos/${JARDINAGEM_ID}`);

    await expect(page.getByRole('heading', { name: /jardinagem residencial completa/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /entrar em contato/i })).toHaveCount(0);

    const criarConta = page.getByRole('link', { name: /criar conta para entrar em contato/i });
    await expect(criarConta).toBeVisible();
    await criarConta.click();
    await expect(page).toHaveURL(/\/cadastro/);
  });
});
