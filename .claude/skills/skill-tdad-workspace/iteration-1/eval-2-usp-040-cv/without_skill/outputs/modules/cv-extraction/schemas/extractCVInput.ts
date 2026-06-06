// Fact (Schema Zod) — USP-040 / AC-040-1, AC-040-5
//
// Schema de fronteira para o upload e a extração de CV.
// Ancora os limites declarados no PRD e na ADR-T-0012:
//   - formatos aceitos: PDF, DOC, DOCX (MIME real, não só extensão)
//   - tamanho máximo: 5 MB
//
// Referências:
//   - PRD USP-040 AC-040-1 (upload PDF/DOC/DOCX até 5MB)
//   - ADR-T-0012 (CVExtractionRequest.mimeType)
//   - technical-design §3.6 (uploadCV valida MIME real, tamanho ≤5MB)

import { z } from 'zod'

/** 5 MB em bytes — limite duro do upload (AC-040-1). */
export const CV_MAX_BYTES = 5 * 1024 * 1024

/** MIME types reais aceitos para CV (AC-040-1). */
export const CV_ALLOWED_MIME = [
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
] as const

export const cvMimeTypeSchema = z.enum(CV_ALLOWED_MIME)
export type CVMimeType = z.infer<typeof cvMimeTypeSchema>

/**
 * Input do uploadCV. O `fileBuffer` é validado por tamanho real;
 * o `mimeType` deve ser detectado do conteúdo (magic bytes), nunca confiar
 * apenas na extensão do nome do arquivo.
 */
export const uploadCVInputSchema = z.object({
  fileBuffer: z
    .instanceof(Buffer)
    .refine((b) => b.byteLength > 0, { message: 'EMPTY_FILE' })
    .refine((b) => b.byteLength <= CV_MAX_BYTES, { message: 'FILE_TOO_LARGE' }),
  mimeType: cvMimeTypeSchema,
  fileName: z.string().min(1).max(255),
})
export type UploadCVInput = z.infer<typeof uploadCVInputSchema>

/** Input do extractCV — referencia o CV já persistido para a Pessoa. */
export const extractCVInputSchema = z.object({
  personId: z.string().uuid(),
})
export type ExtractCVInput = z.infer<typeof extractCVInputSchema>

/**
 * Campos extraídos do CV (output do LLM, validado via Zod no adapter).
 * Espelha ExtractedCVFields da ADR-T-0012. `null` em campo não encontrado —
 * NUNCA inventar valor (anti-hallucination, Risco 4 da ADR-T-0012).
 */
export const extractedCVFieldsSchema = z.object({
  educationLevel: z.string().nullable(),
  educationArea: z.string().nullable(),
  experienceText: z.string().nullable(),
  skillsText: z.string().nullable(),
  coursesText: z.string().nullable(),
  primaryAreaOfInterest: z.string().nullable(),
})
export type ExtractedCVFields = z.infer<typeof extractedCVFieldsSchema>

/**
 * Input do confirmCVFields — o candidato revisa/ajusta e confirma.
 * Confirmação explícita é pré-condição para persistir (AC-040-4).
 */
export const confirmCVFieldsInputSchema = z.object({
  personId: z.string().uuid(),
  fields: extractedCVFieldsSchema,
  confirmed: z.literal(true), // AC-040-4: confirmação explícita obrigatória
})
export type ConfirmCVFieldsInput = z.infer<typeof confirmCVFieldsInputSchema>
