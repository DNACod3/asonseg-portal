// Facts (Vitest integration) — USP-040: Extração automática de CV via IA generativa
//
// Estes são os TESTES FONTE DA VERDADE (RED) para a US. Codificam os critérios
// EARS AC-040-1..5 como asserções máquina-verificáveis (princípio P1 do guia).
//
// Características da US que os facts DEVEM refletir (pedido explícito do usuário):
//   1. DEPENDE DE LLM  -> a extração passa pela porta CVExtractor (mockada aqui).
//        O resultado do LLM é probabilístico/externo; por isso os facts mockam a
//        PORTA (ADR-T-0012 Opção B), nunca o SDK Anthropic direto, e cobrem os
//        dois ramos: sucesso e falha (timeout/provider/parse) com fallback gracioso.
//   2. DEPENDE DE CONSENTIMENTO -> finalidade CV_AI_EXTRACTION (ADR-T-0009 fin.7)
//        é PRÉ-CONDIÇÃO. Sem consentimento ativo, NADA é enviado ao LLM e o CV nem
//        sequer é enviado para extração — a Action retorna CONSENT_REQUIRED.
//
// Padrão de Server Action (project-guideline §"Server Action canônica"):
//   Zod -> requirePermission -> requireActiveConsent -> pré-condições -> withAudit
//   Retorno SEMPRE { ok: true, data } | { ok: false, error }. Nunca throw.
//
// Mapeamento AC -> teste:
//   AC-040-1 -> 'AC-040-1 happy path: invoca LLM e extrai campos estruturados'
//   AC-040-1 -> 'AC-040-1 rejeita arquivo > 5MB antes de chamar o LLM'
//   AC-040-1 -> 'AC-040-1 rejeita MIME não suportado'
//   AC-040-2 -> 'AC-040-2 pré-preenche campos e exige validação do candidato'
//   AC-040-3 -> 'AC-040-3 falha de LLM (timeout) -> fallback gracioso, campos vazios, sem erro disruptivo'
//   AC-040-3 -> 'AC-040-3 extração vazia -> campos vazios para preenchimento manual'
//   AC-040-4 -> 'AC-040-4 não persiste sem confirmação explícita'
//   AC-040-4 -> 'AC-040-4 persiste após confirmação explícita do candidato'
//   AC-040-5 -> 'AC-040-5 armazena o arquivo original vinculado ao candidato'
//   LGPD     -> 'CONSENT: extractCV sem consentimento CV_AI_EXTRACTION retorna CONSENT_REQUIRED e não chama o LLM'
//   LGPD     -> 'CONSENT: uploadCV sem consentimento CV_AI_EXTRACTION retorna CONSENT_REQUIRED e não toca o Storage'
//   AUDIT    -> 'AUDIT: trilha CV_UPLOADED / CV_EXTRACTION_REQUESTED / COMPLETED'
//   AUDIT    -> 'AUDIT: CV_EXTRACTION_FAILED registrado no ramo de falha'
//   AUDIT    -> 'AUDIT: nenhum log contém o conteúdo cru do CV (apenas referência)'
//   AUTHZ    -> 'AUTHZ: permissão negada retorna error e não chama o LLM'
//
// NOTA: os imports abaixo apontam para a implementação AINDA NÃO EXISTENTE
// (`@/modules/cv-extraction`). Os testes nascem VERMELHOS por design (TDD).

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- SUT (a ser implementado) -------------------------------------------------
import { uploadCV } from '@/modules/cv-extraction/actions/uploadCV'
import { extractCV } from '@/modules/cv-extraction/actions/extractCV'
import { confirmCVFields } from '@/modules/cv-extraction/actions/confirmCVFields'

// --- Test doubles / infra de teste (a ser fornecida no harness do projeto) ----
import { cvExtractor } from '@/shared/container'
import { prisma } from '@/shared/lib/prisma'
import { storage } from '@/shared/lib/storage'
import { auditLog } from '@/shared/lib/audit-test-helpers'
import {
  grantConsent,
  revokeConsent,
  asUser,
  seedCandidate,
  pdfFixture,
} from '@/modules/cv-extraction/__tests__/helpers'

const PDF_2MB = pdfFixture({ sizeMB: 2 })
const PDF_6MB = pdfFixture({ sizeMB: 6 })

const EXTRACTED = {
  educationLevel: 'Ensino Médio Completo',
  educationArea: null,
  experienceText: 'Auxiliar de produção (2019-2023)',
  skillsText: 'Excel básico, trabalho em equipe',
  coursesText: 'NR-35 (2022)',
  primaryAreaOfInterest: 'Operacional',
}

describe('USP-040 — Extração automática de CV via IA generativa', () => {
  let personId: string

  beforeEach(async () => {
    vi.restoreAllMocks()
    personId = await seedCandidate()
    // por padrão, consentimento da finalidade 7 está ATIVO
    await grantConsent(personId, 'CV_AI_EXTRACTION')
  })

  // ===========================================================================
  // LGPD — Consentimento é pré-condição (ADR-T-0009 finalidade 7)
  // ===========================================================================
  describe('CONSENT — finalidade CV_AI_EXTRACTION é pré-condição', () => {
    it('CONSENT: uploadCV sem consentimento CV_AI_EXTRACTION retorna CONSENT_REQUIRED e não toca o Storage', async () => {
      await revokeConsent(personId, 'CV_AI_EXTRACTION')
      const storageSpy = vi.spyOn(storage, 'upload')

      const res = await asUser(personId, () =>
        uploadCV({ fileBuffer: PDF_2MB, mimeType: 'application/pdf', fileName: 'cv.pdf' }),
      )

      expect(res.ok).toBe(false)
      if (res.ok) throw new Error('esperado erro')
      expect(res.error.code).toBe('CONSENT_REQUIRED')
      // A finalidade que a UI deve exibir para reaceite
      expect(res.error).toMatchObject({ purpose: 'CV_AI_EXTRACTION' })
      // Nada subiu para o Storage sem consentimento
      expect(storageSpy).not.toHaveBeenCalled()
    })

    it('CONSENT: extractCV sem consentimento CV_AI_EXTRACTION retorna CONSENT_REQUIRED e não chama o LLM', async () => {
      // CV já existe, mas consentimento foi revogado depois
      await asUser(personId, () =>
        uploadCV({ fileBuffer: PDF_2MB, mimeType: 'application/pdf', fileName: 'cv.pdf' }),
      )
      await revokeConsent(personId, 'CV_AI_EXTRACTION')
      const extractSpy = vi.spyOn(cvExtractor, 'extract')

      const res = await asUser(personId, () => extractCV({ personId }))

      expect(res.ok).toBe(false)
      if (res.ok) throw new Error('esperado erro')
      expect(res.error.code).toBe('CONSENT_REQUIRED')
      // CRÍTICO: o CV NÃO é enviado ao provedor LLM sem consentimento ativo
      expect(extractSpy).not.toHaveBeenCalled()
    })

    it('CONSENT: consentimento de OUTRA finalidade não habilita a extração', async () => {
      await revokeConsent(personId, 'CV_AI_EXTRACTION')
      await grantConsent(personId, 'JOB_APPLICATION') // finalidade diferente
      const extractSpy = vi.spyOn(cvExtractor, 'extract')

      const res = await asUser(personId, () => extractCV({ personId }))

      expect(res.ok).toBe(false)
      expect(extractSpy).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // AUTHZ — permissão
  // ===========================================================================
  describe('AUTHZ — permissão', () => {
    it('AUTHZ: permissão negada retorna error e não chama o LLM', async () => {
      const extractSpy = vi.spyOn(cvExtractor, 'extract')

      // Pessoa diferente, sem permissão sobre o CV deste candidato
      const otherPerson = await seedCandidate()
      const res = await asUser(otherPerson, () => extractCV({ personId }))

      expect(res.ok).toBe(false)
      if (res.ok) throw new Error('esperado erro')
      expect(res.error.code).toMatch(/FORBIDDEN|PERMISSION/)
      expect(extractSpy).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // AC-040-1 — Upload + invocação do LLM para extrair campos estruturados
  // ===========================================================================
  describe('AC-040-1 — upload (PDF/DOC/DOCX ≤5MB) invoca a IA generativa', () => {
    it('AC-040-1 happy path: invoca LLM e extrai campos estruturados', async () => {
      const extractSpy = vi
        .spyOn(cvExtractor, 'extract')
        .mockResolvedValue({ ok: true, data: EXTRACTED, metadata: { durationMs: 1200 } })

      await asUser(personId, () =>
        uploadCV({ fileBuffer: PDF_2MB, mimeType: 'application/pdf', fileName: 'cv.pdf' }),
      )
      const res = await asUser(personId, () => extractCV({ personId }))

      expect(res.ok).toBe(true)
      if (!res.ok) throw new Error('esperado sucesso')
      expect(extractSpy).toHaveBeenCalledOnce()
      // O LLM recebe o buffer e o MIME do CV persistido
      expect(extractSpy).toHaveBeenCalledWith(
        expect.objectContaining({ personId, mimeType: 'application/pdf' }),
      )
      // Os 5 grupos de campos do AC-040-1 vêm no resultado
      expect(res.data.fields).toMatchObject({
        educationLevel: expect.any(String),
        experienceText: expect.any(String),
        skillsText: expect.any(String),
        coursesText: expect.any(String),
      })
    })

    it('AC-040-1 aceita DOCX', async () => {
      const extractSpy = vi
        .spyOn(cvExtractor, 'extract')
        .mockResolvedValue({ ok: true, data: EXTRACTED, metadata: { durationMs: 900 } })
      const docx =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' as const

      await asUser(personId, () =>
        uploadCV({ fileBuffer: PDF_2MB, mimeType: docx, fileName: 'cv.docx' }),
      )
      const res = await asUser(personId, () => extractCV({ personId }))

      expect(res.ok).toBe(true)
      expect(extractSpy).toHaveBeenCalledWith(expect.objectContaining({ mimeType: docx }))
    })

    it('AC-040-1 rejeita arquivo > 5MB antes de chamar o LLM', async () => {
      const extractSpy = vi.spyOn(cvExtractor, 'extract')

      const res = await asUser(personId, () =>
        uploadCV({ fileBuffer: PDF_6MB, mimeType: 'application/pdf', fileName: 'grande.pdf' }),
      )

      expect(res.ok).toBe(false)
      if (res.ok) throw new Error('esperado erro')
      expect(res.error.code).toBe('VALIDATION')
      expect(extractSpy).not.toHaveBeenCalled()
    })

    it('AC-040-1 rejeita MIME não suportado', async () => {
      const res = await asUser(personId, () =>
        // @ts-expect-error — MIME inválido deve ser barrado pelo Zod
        uploadCV({ fileBuffer: PDF_2MB, mimeType: 'image/png', fileName: 'foto.png' }),
      )
      expect(res.ok).toBe(false)
      if (res.ok) throw new Error('esperado erro')
      expect(res.error.code).toBe('VALIDATION')
    })
  })

  // ===========================================================================
  // AC-040-2 — Pré-preenchimento + validação obrigatória do candidato
  // ===========================================================================
  describe('AC-040-2 — pré-preenche e exige validação do candidato', () => {
    it('AC-040-2 pré-preenche campos e exige validação do candidato', async () => {
      vi.spyOn(cvExtractor, 'extract').mockResolvedValue({
        ok: true,
        data: EXTRACTED,
        metadata: { durationMs: 1000 },
      })

      await asUser(personId, () =>
        uploadCV({ fileBuffer: PDF_2MB, mimeType: 'application/pdf', fileName: 'cv.pdf' }),
      )
      const res = await asUser(personId, () => extractCV({ personId }))

      expect(res.ok).toBe(true)
      if (!res.ok) throw new Error()
      // valores retornam para a UI revisar...
      expect(res.data.fields).toEqual(EXTRACTED)
      // ...mas NÃO foram confirmados ainda (validação obrigatória do candidato)
      expect(res.data.requiresConfirmation).toBe(true)
      // e ainda não viraram dados confirmados no perfil
      const profile = await prisma.candidateProfile.findFirstOrThrow({ where: { personId } })
      expect(profile.cvLastConfirmedAt).toBeNull()
    })
  })

  // ===========================================================================
  // AC-040-3 — Fallback gracioso quando a extração falha ou volta vazia
  // ===========================================================================
  describe('AC-040-3 — falha/vazio -> campos vazios, sem erro disruptivo', () => {
    it('AC-040-3 falha de LLM (timeout) -> fallback gracioso, campos vazios, sem erro disruptivo', async () => {
      vi.spyOn(cvExtractor, 'extract').mockResolvedValue({
        ok: false,
        error: { code: 'TIMEOUT', message: 'provider timeout' },
      })

      await asUser(personId, () =>
        uploadCV({ fileBuffer: PDF_2MB, mimeType: 'application/pdf', fileName: 'cv.pdf' }),
      )
      const res = await asUser(personId, () => extractCV({ personId }))

      // A Action NÃO falha de forma disruptiva: retorna ok com campos vazios
      expect(res.ok).toBe(true)
      if (!res.ok) throw new Error()
      expect(res.data.fields).toEqual({
        educationLevel: null,
        educationArea: null,
        experienceText: null,
        skillsText: null,
        coursesText: null,
        primaryAreaOfInterest: null,
      })
      expect(res.data.extractionSucceeded).toBe(false)
    })

    it('AC-040-3 falha de provider (PROVIDER_ERROR) também cai em fallback gracioso', async () => {
      vi.spyOn(cvExtractor, 'extract').mockResolvedValue({
        ok: false,
        error: { code: 'PROVIDER_ERROR', message: 'HTTP 503' },
      })
      await asUser(personId, () =>
        uploadCV({ fileBuffer: PDF_2MB, mimeType: 'application/pdf', fileName: 'cv.pdf' }),
      )
      const res = await asUser(personId, () => extractCV({ personId }))
      expect(res.ok).toBe(true)
      if (!res.ok) throw new Error()
      expect(res.data.extractionSucceeded).toBe(false)
    })

    it('AC-040-3 extração vazia -> campos vazios para preenchimento manual', async () => {
      vi.spyOn(cvExtractor, 'extract').mockResolvedValue({
        ok: true,
        data: {
          educationLevel: null,
          educationArea: null,
          experienceText: null,
          skillsText: null,
          coursesText: null,
          primaryAreaOfInterest: null,
        },
        metadata: { durationMs: 800 },
      })
      await asUser(personId, () =>
        uploadCV({ fileBuffer: PDF_2MB, mimeType: 'application/pdf', fileName: 'cv.pdf' }),
      )
      const res = await asUser(personId, () => extractCV({ personId }))
      expect(res.ok).toBe(true)
      if (!res.ok) throw new Error()
      expect(Object.values(res.data.fields).every((v) => v === null)).toBe(true)
    })
  })

  // ===========================================================================
  // AC-040-4 — Confirmação explícita antes de salvar
  // ===========================================================================
  describe('AC-040-4 — confirmação explícita antes de persistir', () => {
    it('AC-040-4 não persiste sem confirmação explícita', async () => {
      const res = await asUser(personId, () =>
        confirmCVFields({
          personId,
          fields: EXTRACTED,
          // @ts-expect-error — sem confirmação explícita o Zod barra
          confirmed: false,
        }),
      )
      expect(res.ok).toBe(false)
      if (res.ok) throw new Error('esperado erro')
      expect(res.error.code).toBe('VALIDATION')
      const profile = await prisma.candidateProfile.findFirstOrThrow({ where: { personId } })
      expect(profile.cvLastConfirmedAt).toBeNull()
    })

    it('AC-040-4 persiste após confirmação explícita do candidato', async () => {
      const res = await asUser(personId, () =>
        confirmCVFields({ personId, fields: EXTRACTED, confirmed: true }),
      )
      expect(res.ok).toBe(true)
      const profile = await prisma.candidateProfile.findFirstOrThrow({ where: { personId } })
      expect(profile.cvLastConfirmedAt).not.toBeNull()
      expect(profile.educationLevel).toBe(EXTRACTED.educationLevel)
    })
  })

  // ===========================================================================
  // AC-040-5 — Armazenar o arquivo original vinculado ao candidato
  // ===========================================================================
  describe('AC-040-5 — armazena o CV original vinculado ao candidato', () => {
    it('AC-040-5 armazena o arquivo original vinculado ao candidato', async () => {
      const storageSpy = vi.spyOn(storage, 'upload')

      const res = await asUser(personId, () =>
        uploadCV({ fileBuffer: PDF_2MB, mimeType: 'application/pdf', fileName: 'cv.pdf' }),
      )

      expect(res.ok).toBe(true)
      // arquivo subiu para o bucket cvs/{personId}/...
      expect(storageSpy).toHaveBeenCalledWith(
        'cvs',
        expect.stringMatching(new RegExp(`^cvs/${personId}/.*\\.pdf$`)),
        expect.any(Buffer),
        expect.objectContaining({ contentType: 'application/pdf' }),
      )
      // vínculo + hash persistidos no perfil do candidato (technical-design §3.6)
      const profile = await prisma.candidateProfile.findFirstOrThrow({ where: { personId } })
      expect(profile.cvStoragePath).toMatch(new RegExp(`^cvs/${personId}/`))
      expect(profile.cvSha256).toMatch(/^[a-f0-9]{64}$/)
      expect(profile.cvUploadedAt).not.toBeNull()
    })
  })

  // ===========================================================================
  // AUDIT — trilha imutável (ADR-T-0012 §LGPD; project-guideline §withAudit)
  // ===========================================================================
  describe('AUDIT — trilha de auditoria sem conteúdo do CV', () => {
    it('AUDIT: trilha CV_UPLOADED / CV_EXTRACTION_REQUESTED / COMPLETED', async () => {
      vi.spyOn(cvExtractor, 'extract').mockResolvedValue({
        ok: true,
        data: EXTRACTED,
        metadata: { durationMs: 1234, tokensInput: 800, tokensOutput: 150, costEstimateCents: 1 },
      })

      await asUser(personId, () =>
        uploadCV({ fileBuffer: PDF_2MB, mimeType: 'application/pdf', fileName: 'cv.pdf' }),
      )
      await asUser(personId, () => extractCV({ personId }))

      const events = await auditLog.eventsFor(personId)
      expect(events.map((e) => e.type)).toEqual(
        expect.arrayContaining([
          'CV_UPLOADED',
          'CV_EXTRACTION_REQUESTED',
          'CV_EXTRACTION_COMPLETED',
        ]),
      )
      // metadata de custo/duração registrada no COMPLETED
      const completed = events.find((e) => e.type === 'CV_EXTRACTION_COMPLETED')
      expect(completed?.metadata).toMatchObject({ durationMs: 1234 })
    })

    it('AUDIT: CV_EXTRACTION_FAILED registrado no ramo de falha', async () => {
      vi.spyOn(cvExtractor, 'extract').mockResolvedValue({
        ok: false,
        error: { code: 'TIMEOUT', message: 'provider timeout' },
      })
      await asUser(personId, () =>
        uploadCV({ fileBuffer: PDF_2MB, mimeType: 'application/pdf', fileName: 'cv.pdf' }),
      )
      await asUser(personId, () => extractCV({ personId }))

      const events = await auditLog.eventsFor(personId)
      const failed = events.find((e) => e.type === 'CV_EXTRACTION_FAILED')
      expect(failed).toBeDefined()
      expect(failed?.metadata).toMatchObject({ errorCode: 'TIMEOUT' })
    })

    it('AUDIT: nenhum log contém o conteúdo cru do CV (apenas referência)', async () => {
      vi.spyOn(cvExtractor, 'extract').mockResolvedValue({
        ok: true,
        data: EXTRACTED,
        metadata: { durationMs: 500 },
      })
      await asUser(personId, () =>
        uploadCV({ fileBuffer: PDF_2MB, mimeType: 'application/pdf', fileName: 'cv.pdf' }),
      )
      await asUser(personId, () => extractCV({ personId }))

      const events = await auditLog.eventsFor(personId)
      for (const e of events) {
        const serialized = JSON.stringify(e)
        // nunca o buffer/base64 do CV no log (minimização — ADR-T-0012)
        expect(serialized).not.toContain(PDF_2MB.toString('base64').slice(0, 64))
        // referência por path/personId é permitida
      }
      const uploaded = events.find((e) => e.type === 'CV_UPLOADED')
      expect(uploaded?.metadata).toMatchObject({
        cvStoragePath: expect.stringMatching(new RegExp(`^cvs/${personId}/`)),
      })
    })

    it('AUDIT: confirmação registra CV_USER_CONFIRMED_FIELDS', async () => {
      await asUser(personId, () =>
        confirmCVFields({ personId, fields: EXTRACTED, confirmed: true }),
      )
      const events = await auditLog.eventsFor(personId)
      expect(events.map((e) => e.type)).toContain('CV_USER_CONFIRMED_FIELDS')
    })
  })
})
