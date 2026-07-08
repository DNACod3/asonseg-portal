// Barrel do módulo `cv-extraction` (USP-040 / ADR-0012).
// Todos os imports externos devem passar por este arquivo (nunca deep paths).

// ── Porta CVExtractor + tipos ──────────────────────────────────────────────
export { CV_EXTRACTOR_TOKEN } from './ports/cv-extractor.port';
export type {
  CVExtractor,
  CvMimeType,
  CvExtractionInput,
  CvExtractedFields,
  CvExtractionUsage,
  CvExtractionFailureReason,
  CvExtractionResult,
} from './ports/cv-extractor.port';

// ── Domínio: MIME real + tamanho (CVE-01) ──────────────────────────────────
export { detectCvMime, isWithinCvSizeLimit, MAX_CV_BYTES } from './domain/mime';

// ── Domínio: parse dos campos extraídos (CVE-02/CVE-05) ────────────────────
export { parseExtractedFields } from './domain/extracted-fields';

// ── Domínio: custo estimado + rate limit diário (CVE-07/CVE-08) ────────────
export { estimateExtractionCostUsd } from './domain/cost';
export { DAILY_CV_UPLOAD_LIMIT, startOfDaySaoPaulo, isOverDailyLimit } from './domain/rate-limit';

// ── Adapter fake (teste/E2E) ────────────────────────────────────────────────
export { FakeCVExtractor } from './adapters/fake-cv-extractor';

// ── Schemas Zod (confirmação + upload) ──────────────────────────────────────
export { confirmCvFieldsSchema } from './schemas/confirm-cv-fields.schema';
export type { ConfirmCvFieldsInput, ConfirmCvFieldsData } from './schemas/confirm-cv-fields.schema';
export { cvUploadFileSchema, parseCvUploadFormData } from './schemas/upload-cv-file.schema';
export type { CvUploadFileInput } from './schemas/upload-cv-file.schema';

// ── Server Action: upload (CVE-01) ──────────────────────────────────────────
export { uploadCv } from './actions/upload-cv';
export type { UploadCvResult } from './actions/upload-cv';

// ── Server Action: extração (CVE-02) ────────────────────────────────────────
export { extractCvFromUpload } from './actions/extract-cv';
export type { ExtractCvResult } from './actions/extract-cv';
