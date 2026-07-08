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
