// .specs/features/extracao-cv-ia/tests/unit/usp-040-extracao-cv.spec.ts
// FACTS (red) — fonte da verdade da USP-040 (Extração de CV via IA generativa).
// Mover para modules/cv-extraction/__tests__/ na fase Execute, conectando à Server Action
// real (uploadCvEExtrair / confirmCVFields) e mockando a PORTA CVExtractor (nunca o SDK).
//
// Fontes: PRD §5.2 USP-040 · ADR-T-0012 (porta CVExtractor + adapter Anthropic) ·
//         ADR-T-0009 (consentimento finalidade 7 CV_AI_EXTRACTION) · ADR-0018 negócio ·
//         project-guideline §4 (Server Action), §7 (LLM porta), §8 (consentimento), §12, §21.
//
// Cobertura dos casos obrigatórios de Server Action sensível (project-guideline §12):
//   happy path · validação Zod (mime/tamanho) · permissão (papel candidato) ·
//   consentimento ausente (CV_AI_EXTRACTION) · concorrência (não há corrida relevante aqui —
//   justificado: cada upload é idempotente por arquivo/uuid; documentado como it.todo).
//
// IMPORTANTE (P3 — LLM tem eval suite): a QUALIDADE da extração (precisão/recall/alucinação)
// e a LATÊNCIA (≤30s p95) NÃO são ancoradas aqui — são facts da eval suite em
// modules/cv-extraction/evals/baseline.json (ver §21.2). Estes testes ancoram o COMPORTAMENTO
// determinístico em torno do LLM (consentimento, armazenamento, fallback, validação humana,
// auditoria, não-vazamento), mockando a porta com retornos fixos.

import { describe, it, expect } from 'vitest'

// Stubs temporários — substituir pelos imports reais na fase Execute:
//   import { uploadCvEExtrair, confirmCVFields } from '@/modules/cv-extraction'
function uploadCvEExtrair(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-040 (uploadCvEExtrair)')
}
function confirmCVFields(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-040 (confirmCVFields)')
}

const candidatoComConsentimento = {
  personId: 'person-candidato-1',
  papeis: ['CANDIDATO'] as const,
  consentimentos: ['CV_AI_EXTRACTION'] as const,
}

const cvPdfValido = {
  fileName: 'curriculo-maria.pdf',
  mimeType: 'application/pdf' as const,
  sizeBytes: 2 * 1024 * 1024, // 2MB
  fileBuffer: Buffer.from('%PDF-1.7 conteudo sintetico'),
}

describe('USP-040 — Extração automática de CV via IA generativa', () => {
  describe('AC-040-1 — WHEN upload (PDF/DOC/DOCX ≤5MB) THE SYSTEM SHALL invocar LLM e extrair campos', () => {
    it('happy path: armazena o arquivo, invoca a porta CVExtractor e retorna campos estruturados', async () => {
      const res = await uploadCvEExtrair({ ...candidatoComConsentimento, file: cvPdfValido })
      expect(res).toMatchObject({ ok: true })
      // E: data.fields contém educationLevel/educationArea/experienceText/skillsText/coursesText
      // E: a porta CVExtractor.extract foi chamada exatamente uma vez (mock)
      // E: o adapter concreto (@anthropic-ai/sdk) NUNCA é importado pelo código consumidor (ADR-T-0012, §7)
    })

    it('audita CV_EXTRACTION_REQUESTED antes do envio e CV_EXTRACTION_COMPLETED após o retorno', async () => {
      const res = await uploadCvEExtrair({ ...candidatoComConsentimento, file: cvPdfValido })
      expect(res).toMatchObject({ ok: true })
      // E: eventos de auditoria na ordem REQUESTED -> COMPLETED, sem conteúdo do CV no payload
    })

    it.each([
      ['image/png', 1 * 1024 * 1024, 'FORMATO_NAO_SUPORTADO'],
      ['application/zip', 1 * 1024 * 1024, 'FORMATO_NAO_SUPORTADO'],
      ['application/pdf', 6 * 1024 * 1024, 'ARQUIVO_MUITO_GRANDE'],
    ])('validação Zod: rejeita mime=%s tamanho=%s sem invocar o LLM', async (mimeType, sizeBytes, code) => {
      const res = await uploadCvEExtrair({
        ...candidatoComConsentimento,
        file: { ...cvPdfValido, mimeType, sizeBytes },
      })
      expect(res).toMatchObject({ ok: false, error: { code } })
      // E: a porta CVExtractor.extract NÃO foi chamada (validação acontece antes do envio)
    })
  })

  describe('AC-040-2 — WHEN extração retorna THE SYSTEM SHALL pré-preencher + exigir validação obrigatória', () => {
    it('pré-preenche os campos do formulário com os valores extraídos', async () => {
      const res = await uploadCvEExtrair({ ...candidatoComConsentimento, file: cvPdfValido })
      expect(res).toMatchObject({
        ok: true,
        data: { prefilled: true },
      })
      // E: cada campo pré-preenchido vem marcado como needsValidation: true
    })

    it.todo('marca os campos extraídos como "extraído automaticamente — requer validação"')
  })

  describe('AC-040-3 — IF extração falha/vazia THEN campos vazios, sem erro disruptivo (fallback gracioso)', () => {
    it.each(['TIMEOUT', 'PROVIDER_ERROR', 'PARSE_ERROR'])(
      'erro %s: degrada para preenchimento manual sem erro bloqueante e audita CV_EXTRACTION_FAILED',
      async (errorCode) => {
        // mock da porta: extract -> { ok: false, error: { code: errorCode } }
        const res = await uploadCvEExtrair({
          ...candidatoComConsentimento,
          file: cvPdfValido,
          __mockExtractorError: errorCode,
        })
        // A ação NÃO retorna erro bloqueante: upload teve sucesso, campos vazios.
        expect(res).toMatchObject({ ok: true, data: { prefilled: false, fields: {} } })
        // E: evento de auditoria CV_EXTRACTION_FAILED com o error.code
        // E: o arquivo original permanece armazenado (AC-040-5)
      },
    )

    it('retorno de sucesso com todos os campos nulos é tratado como vazio, sem erro disruptivo', async () => {
      const res = await uploadCvEExtrair({
        ...candidatoComConsentimento,
        file: cvPdfValido,
        __mockExtractorAllNull: true,
      })
      expect(res).toMatchObject({ ok: true, data: { prefilled: false } })
    })
  })

  describe('AC-040-4 — THE SYSTEM SHALL exigir confirmação explícita antes de salvar (invariante)', () => {
    it('bloqueia salvar quando não há confirmação explícita do candidato', async () => {
      const res = await confirmCVFields({
        ...candidatoComConsentimento,
        fields: { educationLevel: 'Ensino Superior' },
        confirmed: false,
      })
      expect(res).toMatchObject({ ok: false, error: { code: 'CONFIRMATION_REQUIRED' } })
      // E: nenhum campo é persistido no candidate_profiles
    })

    it('persiste os campos quando o candidato confirma explicitamente e audita CV_USER_CONFIRMED_FIELDS', async () => {
      const res = await confirmCVFields({
        ...candidatoComConsentimento,
        fields: { educationLevel: 'Ensino Superior', educationArea: 'Administração' },
        confirmed: true,
      })
      expect(res).toMatchObject({ ok: true })
      // E: evento de auditoria CV_USER_CONFIRMED_FIELDS registrado
    })
  })

  describe('AC-040-5 — THE SYSTEM SHALL armazenar o arquivo original do CV vinculado ao candidato (invariante)', () => {
    it('armazena o arquivo original no caminho cvs/{personId}/{uuid} e vincula ao candidato', async () => {
      const res = await uploadCvEExtrair({ ...candidatoComConsentimento, file: cvPdfValido })
      expect(res).toMatchObject({ ok: true })
      // E: storage_path no formato cvs/person-candidato-1/<uuid>
      // E: candidate_profiles.cv_storage_path referencia esse caminho
    })

    it.todo('preserva o arquivo armazenado mesmo quando a extração falha')
  })

  // ---- Casos obrigatórios de Server Action sensível (project-guideline §12) ----

  describe('Consentimento — finalidade CV_AI_EXTRACTION (ADR-T-0009 finalidade 7)', () => {
    it('recusa com CONSENT_REQUIRED e NÃO envia o CV ao LLM quando o consentimento está ausente', async () => {
      const res = await uploadCvEExtrair({
        personId: 'person-sem-consentimento',
        papeis: ['CANDIDATO'],
        consentimentos: [], // sem CV_AI_EXTRACTION
        file: cvPdfValido,
      })
      expect(res).toMatchObject({ ok: false, error: { code: 'CONSENT_REQUIRED' } })
      // E: requireActiveConsent recusa ANTES de qualquer upload/envio (ordem da §4)
      // E: a porta CVExtractor.extract NÃO foi chamada
    })
  })

  describe('Permissão — requirePermission (papel candidato)', () => {
    it('recusa quando o usuário não tem o papel candidato', async () => {
      const res = await uploadCvEExtrair({
        personId: 'person-sem-papel',
        papeis: [], // sem CANDIDATO
        consentimentos: ['CV_AI_EXTRACTION'],
        file: cvPdfValido,
      })
      expect(res).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } })
    })
  })

  describe('LGPD — não-vazamento de conteúdo sensível em logs (ADR-T-0012)', () => {
    it.todo('nenhum log (pino) nem evento de auditoria contém o conteúdo do CV ou o raw response do LLM')
  })

  describe('Concorrência', () => {
    // Justificativa: não há corrida de unicidade no upload (cada upload gera storage_path único
    // por uuid e cada confirmação opera sobre o próprio perfil do candidato). Mantido como
    // lembrete caso a fase Execute identifique idempotência de re-upload concorrente.
    it.todo('re-upload concorrente do mesmo candidato não cria perfis/arquivos duplicados')
  })
})
