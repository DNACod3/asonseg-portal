// FACTS (red) — fonte da verdade da US #111 (seed de taxonomia + checklist).
// Mover para os locais definitivos na fase Execute:
//   - idempotência do seed  -> prisma/__tests__/seed.integration.test.ts (banco efêmero)
//   - existência do checklist -> tests/docs/checklist-empresa-fantasma.test.ts
//
// Esta US é de INFRA: sem Server Action / permissão / consentimento / View Model,
// então os casos obrigatórios de §12 e o E2E Playwright NÃO se aplicam (ver traceability).

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Stub temporário: substituir pelo runner real do seed e pelo cliente Prisma de teste
// na fase Execute (banco efêmero — ver project-guideline §12, integração com Prisma).
// import { runSeed } from '@/prisma/seed'
// import { prisma } from '@/shared/lib/prisma'
async function runSeed(): Promise<never> {
  throw new Error('not implemented — fact red da US #111 (prisma/seed.ts)')
}
async function countTaxonomy(): Promise<{ regions: number; jobAreas: number; serviceCategories: number }> {
  throw new Error('not implemented — leitura de contagens via Prisma de teste')
}

describe('US #111 — Seed de taxonomia inicial', () => {
  describe('AC-111-1 — seed popula as três tabelas', () => {
    it('popula regions, job_areas e service_categories com valores iniciais', async () => {
      await runSeed()
      const c = await countTaxonomy()
      expect(c.regions).toBeGreaterThan(0)
      expect(c.jobAreas).toBeGreaterThan(0)
      expect(c.serviceCategories).toBeGreaterThan(0)
      // E: toda área/categoria semeada nasce oficial (is_suggestion = false) — não é sugestão de usuário
    })

    it.todo('toda job_area e service_category semeada tem is_suggestion = false')
    it.todo('toda region semeada é de Florianópolis/SC e está is_active = true')
    // Lacuna: a LISTA exata (quais bairros/áreas/categorias) vem do protótipo refinado
    // com a diretoria (D-007/QP-010) — ainda pendente. Quando definida, fixar os nomes aqui.
    it.todo('contém os nomes canônicos da taxonomia inicial (definir lista — D-007/QP-010)')
  })

  describe('AC-111-1 — idempotência (re-rodar não duplica)', () => {
    it('mantém as contagens estáveis ao executar o seed duas vezes', async () => {
      await runSeed()
      const first = await countTaxonomy()
      await runSeed()
      const second = await countTaxonomy()
      expect(second).toEqual(first)
    })
    it.todo('não cria registro duplicado por "name" (constraint @unique respeitada via upsert)')
  })
})

describe('US #111 — AC-111-2 — checklist de empresa-fantasma é documento verificável', () => {
  // O issue prevê o doc em docs/. Caminho definitivo a confirmar na fase Execute.
  const CHECKLIST_PATH = resolve(process.cwd(), 'docs/operacao/checklist-empresa-fantasma.md')

  it('o documento de checklist existe no repositório', () => {
    expect(existsSync(CHECKLIST_PATH)).toBe(true)
  })

  it('o documento cobre os dados da Empresa a verificar e os critérios de decisão', () => {
    const doc = existsSync(CHECKLIST_PATH) ? readFileSync(CHECKLIST_PATH, 'utf-8').toLowerCase() : ''
    // dados a verificar (USP-017)
    expect(doc).toContain('cnpj')
    expect(doc).toContain('razão social')
    expect(doc).toContain('endereço')
    // critérios objetivos de decisão
    expect(doc).toMatch(/aprovar|aprova[çc]ão/)
    expect(doc).toMatch(/rejeitar|rejei[çc]ão/)
  })

  it.todo('o checklist orienta verificação de CNPJ além do dígito verificador (RP-005)')
})
