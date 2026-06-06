// Fact (E2E Playwright) — USP-040: Extração automática de CV via IA generativa
//
// Esqueleto do fluxo crítico ponta-a-ponta (Top 8 fluxos, fluxo nº1 do
// technical-design §"Auto-cadastro + ativação papel candidato + upload CV + extração").
//
// O provedor LLM é DETERMINÍSTICO neste nível: a extração é interceptada/stubada
// (rota da Server Action ou flag de ambiente E2E_LLM_STUB) para garantir um teste
// estável — não validamos a qualidade do LLM aqui (isso é a eval suite), apenas o
// fluxo de UI: consentimento -> upload -> pré-preenchimento -> revisão -> confirmação.
//
// Pré-requisito de ambiente: stack local Supabase CLI (ADR-0016), seed de candidato.

import { test, expect } from '@playwright/test'

// Helpers do harness E2E do projeto (a serem fornecidos)
import { loginAsCandidate, stubCVExtractor, fixturePath } from './support/helpers'

test.describe('USP-040 — Extração automática de CV @e2e', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCandidate(page, { email: 'maria.e2e@example.test' })
  })

  test('AC-040-1/2/4/5 fluxo feliz: consentimento -> upload -> pré-preenche -> confirma', async ({
    page,
  }) => {
    // LLM stubado com retorno determinístico
    await stubCVExtractor(page, {
      ok: true,
      data: {
        educationLevel: 'Ensino Médio Completo',
        educationArea: null,
        experienceText: 'Auxiliar de produção (2019-2023)',
        skillsText: 'Excel básico',
        coursesText: 'NR-35',
        primaryAreaOfInterest: 'Operacional',
      },
    })

    await page.goto('/candidato/cv')

    // LGPD: termo da finalidade CV_AI_EXTRACTION é exibido e exige aceite
    await expect(page.getByRole('heading', { name: /extração.*currículo.*IA/i })).toBeVisible()
    await page.getByRole('checkbox', { name: /aceito.*tratamento.*provedor/i }).check()
    await page.getByRole('button', { name: /aceitar e continuar/i }).click()

    // AC-040-1/5: upload do arquivo
    await page.setInputFiles('input[type="file"]', fixturePath('cv-maria.pdf'))
    await page.getByRole('button', { name: /enviar currículo/i }).click()

    // AC-040-2: campos pré-preenchidos visíveis e marcados como "preenchido automaticamente"
    await expect(page.getByLabel(/escolaridade/i)).toHaveValue('Ensino Médio Completo')
    await expect(page.getByText(/preenchido automaticamente/i).first()).toBeVisible()

    // AC-040-4: confirmação explícita obrigatória
    const salvar = page.getByRole('button', { name: /confirmar e salvar/i })
    await expect(salvar).toBeDisabled() // desabilitado até confirmar revisão
    await page.getByRole('checkbox', { name: /revisei.*informações/i }).check()
    await expect(salvar).toBeEnabled()
    await salvar.click()

    await expect(page.getByText(/dados salvos/i)).toBeVisible()
  })

  test('AC-040-3 fallback gracioso: falha do LLM deixa formulário vazio sem erro disruptivo', async ({
    page,
  }) => {
    await stubCVExtractor(page, { ok: false, error: { code: 'TIMEOUT', message: 'timeout' } })

    await page.goto('/candidato/cv')
    await page.getByRole('checkbox', { name: /aceito.*tratamento.*provedor/i }).check()
    await page.getByRole('button', { name: /aceitar e continuar/i }).click()
    await page.setInputFiles('input[type="file"]', fixturePath('cv-maria.pdf'))
    await page.getByRole('button', { name: /enviar currículo/i }).click()

    // Mensagem amigável, não disruptiva
    await expect(
      page.getByText(/não foi possível.*automaticamente.*preencha manualmente/i),
    ).toBeVisible()
    // Sem dialog de erro / sem stack trace
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    // Campos vazios, editáveis
    await expect(page.getByLabel(/escolaridade/i)).toHaveValue('')
    await expect(page.getByLabel(/escolaridade/i)).toBeEditable()
  })

  test('LGPD: sem aceitar o termo, o upload não é possível', async ({ page }) => {
    await page.goto('/candidato/cv')
    // Sem aceitar o consentimento, o campo de upload está bloqueado
    await expect(page.locator('input[type="file"]')).toBeDisabled()
  })
})
