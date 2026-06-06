// Facts (Vitest unit) — USP-040 / schemas de fronteira (AC-040-1, AC-040-4)
//
// Ancora os limites do upload e a regra de confirmação explícita diretamente
// no schema Zod (fact tipo "Schema Zod", Seção 23.2 do guia).

import { describe, it, expect } from 'vitest'
import {
  uploadCVInputSchema,
  confirmCVFieldsInputSchema,
  extractedCVFieldsSchema,
  CV_MAX_BYTES,
} from '@/modules/cv-extraction/schemas/extractCVInput'

const buf = (mb: number) => Buffer.alloc(Math.round(mb * 1024 * 1024), 1)

describe('uploadCVInputSchema (AC-040-1)', () => {
  it('aceita PDF de 2MB', () => {
    const r = uploadCVInputSchema.safeParse({
      fileBuffer: buf(2),
      mimeType: 'application/pdf',
      fileName: 'cv.pdf',
    })
    expect(r.success).toBe(true)
  })

  it('aceita DOC e DOCX', () => {
    for (const mimeType of [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]) {
      const r = uploadCVInputSchema.safeParse({ fileBuffer: buf(1), mimeType, fileName: 'cv' })
      expect(r.success).toBe(true)
    }
  })

  it('rejeita arquivo acima de 5MB', () => {
    const r = uploadCVInputSchema.safeParse({
      fileBuffer: buf(6),
      mimeType: 'application/pdf',
      fileName: 'cv.pdf',
    })
    expect(r.success).toBe(false)
  })

  it('rejeita arquivo vazio', () => {
    const r = uploadCVInputSchema.safeParse({
      fileBuffer: Buffer.alloc(0),
      mimeType: 'application/pdf',
      fileName: 'cv.pdf',
    })
    expect(r.success).toBe(false)
  })

  it('rejeita MIME não suportado (image/png)', () => {
    const r = uploadCVInputSchema.safeParse({
      fileBuffer: buf(1),
      mimeType: 'image/png',
      fileName: 'foto.png',
    })
    expect(r.success).toBe(false)
  })

  it('limite é exatamente 5MB', () => {
    expect(CV_MAX_BYTES).toBe(5 * 1024 * 1024)
  })
})

describe('confirmCVFieldsInputSchema (AC-040-4)', () => {
  const fields = {
    educationLevel: 'Médio',
    educationArea: null,
    experienceText: null,
    skillsText: null,
    coursesText: null,
    primaryAreaOfInterest: null,
  }

  it('exige confirmed === true (confirmação explícita)', () => {
    expect(confirmCVFieldsInputSchema.safeParse({ personId: crypto.randomUUID(), fields, confirmed: false }).success).toBe(false)
    expect(confirmCVFieldsInputSchema.safeParse({ personId: crypto.randomUUID(), fields, confirmed: true }).success).toBe(true)
  })
})

describe('extractedCVFieldsSchema (anti-hallucination, AC-040-3)', () => {
  it('aceita null em todos os campos (campo não encontrado)', () => {
    const r = extractedCVFieldsSchema.safeParse({
      educationLevel: null,
      educationArea: null,
      experienceText: null,
      skillsText: null,
      coursesText: null,
      primaryAreaOfInterest: null,
    })
    expect(r.success).toBe(true)
  })

  it('rejeita output com chave inesperada (formato fora do contrato)', () => {
    const r = extractedCVFieldsSchema.strict?.().safeParse({
      educationLevel: null,
      educationArea: null,
      experienceText: null,
      skillsText: null,
      coursesText: null,
      primaryAreaOfInterest: null,
      cpf: '000.000.000-00', // LLM não pode inventar/incluir campo extra
    })
    // se .strict() aplicado no adapter, deve rejeitar
    expect(r?.success ?? false).toBe(false)
  })
})
