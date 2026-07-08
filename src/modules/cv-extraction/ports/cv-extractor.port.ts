import { createToken } from '@/shared/container';

/**
 * Tipos MIME de CV suportados pelo MVP (USP-040 / CVE-01). Definidos aqui (não
 * em `domain/mime.ts`) porque fazem parte da assinatura do port; `domain/mime.ts`
 * (T4) reexporta este tipo junto de `detectCvMime`/`MAX_CV_BYTES`.
 */
export type CvMimeType = 'pdf' | 'doc' | 'docx';

/** Entrada da extração: bytes do arquivo já validados (MIME real + tamanho). */
export interface CvExtractionInput {
  readonly content: Uint8Array;
  readonly mimeType: CvMimeType;
  readonly fileName?: string;
}

/**
 * Campos estruturados extraídos do CV (USP-040 / CVE-02). Todos opcionais/nulos
 * — a IA é best-effort; campos ausentes ficam para preenchimento manual.
 */
export interface CvExtractedFields {
  readonly educationLevel?: string | null;
  readonly educationArea?: string | null;
  readonly experienceText?: string | null;
  readonly skillsText?: string | null;
  readonly coursesText?: string | null;
}

/** Metadados de custo/uso de uma chamada de extração (CVE-08) — nunca PII. */
export interface CvExtractionUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly durationMs: number;
  readonly estimatedCostUsd: number;
  readonly model: string;
}

/** Motivo de falha de extração — sempre tratado como fallback gracioso (CVE-05/CVE-MN-06). */
export type CvExtractionFailureReason = 'EMPTY' | 'MALFORMED' | 'PROVIDER_ERROR' | 'TIMEOUT';

export type CvExtractionResult =
  | { readonly ok: true; readonly fields: CvExtractedFields; readonly usage: CvExtractionUsage }
  | {
      readonly ok: false;
      readonly reason: CvExtractionFailureReason;
      readonly usage?: Partial<CvExtractionUsage>;
    };

/**
 * Porta para extração de campos estruturados de um CV via IA generativa
 * (ADR-0012). Consumidores dependem exclusivamente desta interface — nunca do
 * SDK do provedor concreto (guarda estática CVE-MN-05). Resolução via
 * `container.ts` (`CV_EXTRACTOR_TOKEN`).
 *
 * **Contrato: nunca lança.** Qualquer erro do provedor/parse é capturado pelo
 * adapter e devolvido como `{ ok: false, reason }` — é isso que torna o
 * fallback gracioso (CVE-05) estruturalmente garantido, não uma convenção que
 * o consumidor precisa lembrar de respeitar.
 */
export interface CVExtractor {
  extract(input: CvExtractionInput): Promise<CvExtractionResult>;
}

export const CV_EXTRACTOR_TOKEN = createToken<CVExtractor>('CVExtractor');
