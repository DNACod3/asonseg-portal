// Port (interface) — USP-040
//
// O consumidor (Server Action extractCV) depende APENAS desta porta,
// nunca do SDK @anthropic-ai/sdk diretamente (ADR-T-0012, Opção B).
// Os testes-fonte-da-verdade mockam ESTA porta — não o SDK.
//
// Referência: ADR-T-0012 §"Modelagem da integração".

export interface CVExtractor {
  readonly providerName: string // 'anthropic-claude', 'openai', etc.
  readonly modelName: string // ex: 'claude-haiku-4-5-20251001'
  readonly providerVersion: string // semver do adapter — para auditoria

  extract(input: CVExtractionRequest): Promise<CVExtractionResult>
}

export type CVExtractionRequest = {
  personId: string
  fileBuffer: Buffer
  mimeType:
    | 'application/pdf'
    | 'application/msword'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  fileName: string
}

export type ExtractedCVFields = {
  educationLevel: string | null
  educationArea: string | null
  experienceText: string | null
  skillsText: string | null
  coursesText: string | null
  primaryAreaOfInterest: string | null
}

export type ExtractionMetadata = {
  durationMs: number
  tokensInput?: number
  tokensOutput?: number
  costEstimateCents?: number
}

export type CVExtractionErrorCode =
  | 'TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'PARSE_ERROR'
  | 'UNSUPPORTED_FORMAT'

export type CVExtractionResult =
  | { ok: true; data: ExtractedCVFields; metadata: ExtractionMetadata }
  | { ok: false; error: { code: CVExtractionErrorCode; message: string } }
