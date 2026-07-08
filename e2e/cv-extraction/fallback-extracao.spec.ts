import { test, expect } from '@playwright/test';

/**
 * E2E de "Extração automática de CV via IA generativa" (USP-040) — caminho de
 * fallback: extração falha/vazia/malformada → `CV_EXTRACTION_FAILED` +
 * mensagem amigável + formulário manual editável, sem erro disruptivo
 * (CVE-05 / CVE-MN-06) — o cadastro segue completável.
 *
 * **Mesma decisão de pirâmide de testes de
 * `e2e/cv-extraction/upload-extrair-confirmar.spec.ts`** (SPEC_DEVIATION
 * documentado ali, com a lista completa de precedentes): o projeto não
 * semeia sessão Supabase no E2E, então o caminho de fallback autenticado —
 * `FakeCVExtractor` retornando `{ ok: false }` → `withAudit(CV_EXTRACTION_FAILED)`
 * → `{ extracted: null, fallback: true }` sem `throw` → UI mostra a mensagem
 * amigável e os campos vazios editáveis — é verificado de forma autoritativa
 * em:
 *   - `src/modules/cv-extraction/__tests__/extract-cv.int.test.ts` (`CVE-05/CVE-MN-06: falha do extractor (ok:false) vira fallback gracioso, sem throw`),
 *   - `src/modules/cv-extraction/components/__tests__/CvUploadForm.test.tsx` (`CVE-MN-06: extração com fallback mostra mensagem amigável e campos vazios editáveis, sem erro disruptivo`).
 * O que o E2E garante, sem sessão, é o mesmo confinamento de rota: não há
 * caminho anônimo para alcançar o formulário de upload/extração — logo
 * também não há caminho anônimo para acionar (ou vazar) o fallback.
 */

test.describe('Extração de CV via IA — fallback gracioso (USP-040)', () => {
  test('sem sessão, nenhuma superfície de extração/fallback fica acessível em /candidato', async ({
    page,
  }) => {
    await page.goto('/candidato');
    await expect(page).toHaveURL(/\/login(\?|$)/);
    // Nem o formulário de upload, nem qualquer mensagem de fallback da IA,
    // vazam para o visitante anônimo.
    await expect(page.locator('#cv-file')).toHaveCount(0);
    await expect(page.getByText(/não conseguimos extrair/i)).toHaveCount(0);
  });
});
