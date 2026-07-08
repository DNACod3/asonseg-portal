import { test, expect } from '@playwright/test';

/**
 * E2E de "Extração automática de CV via IA generativa" (USP-040) — caminho
 * feliz: upload → extração → pré-preenchimento ("sugerido pela IA") →
 * confirmação → campos persistidos (CVE-01 a CVE-04).
 *
 * O formulário `CvUploadForm` vive dentro da rota autenticada `(app)/candidato`
 * — não é uma rota própria. `uploadCv` exige, além de sessão, um
 * `CandidateProfile` já criado (precondição de CVE-01).
 *
 * **Decisão de pirâmide de testes (SPEC_DEVIATION documentado — mesma decisão
 * de `e2e/candidato.spec.ts`, `e2e/candidaturas/candidatar-se.spec.ts`,
 * `e2e/companies/editar-empresa.spec.ts`, `e2e/moderacao/moderar-rascunho.spec.ts`):**
 * o projeto **não semeia sessão Supabase no E2E** (sem infra de
 * session-seeding — os candidatos do seed demo nascem sem credencial
 * Supabase, `supabaseUserId: null`, então não há usuário de teste capaz de
 * logar pela UI real; forjar cookie/token fora do fluxo de UI é o que o
 * projeto decidiu não fazer). O caminho autenticado completo — upload com MIME
 * real/tamanho, rate limit diário, extração via `CVExtractor` (seam
 * `FakeCVExtractor`, `CV_EXTRACTOR_FAKE=true` neste ambiente E2E, ver
 * `playwright.config.ts`), pré-preenchimento marcado "sugerido pela IA"
 * (CVE-03) e persistência só após confirmação (CVE-04/CVE-MN-01) — é
 * verificado de forma autoritativa, ponta-a-ponta contra Postgres real (ou
 * DOM real via Testing Library), em:
 *   - `src/modules/cv-extraction/__tests__/upload-cv.int.test.ts` (upload completo + MIME/tamanho/consentimento/rate limit),
 *   - `src/modules/cv-extraction/__tests__/extract-cv.int.test.ts` (extração via porta + auditoria de custo),
 *   - `src/modules/cv-extraction/__tests__/confirm-cv-fields.int.test.ts` (persistência dos 5 campos),
 *   - `src/modules/cv-extraction/components/__tests__/CvUploadForm.test.tsx` (prefill "sugerido pela IA" + confirmação, CVE-03).
 * O que o E2E garante, sem sessão, é o contrato que o visitante anônimo
 * realmente vê no navegador: a rota que hospeda o upload de CV é confinada à
 * sessão — não há caminho para alcançar o formulário sem login.
 */

test.describe('Extração de CV via IA — caminho feliz (USP-040)', () => {
  test('upload de CV exige sessão ativa: sem login, /candidato redireciona para /login', async ({
    page,
  }) => {
    await page.goto('/candidato');
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.locator('h1')).toContainText('Entrar');
    // O formulário de upload de CV nunca chega a ser renderizado sem sessão.
    await expect(page.locator('#cv-file')).toHaveCount(0);
  });
});
