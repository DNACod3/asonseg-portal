import { z } from 'zod';
import type { CvExtractedFields } from '../ports/cv-extractor.port';

/**
 * Parse/validação defensiva do JSON retornado pelo LLM (USP-040 / CVE-02, A-09
 * — sem structured outputs; o modelo devolve JSON por instrução de prompt).
 * Regra pura, sem IO.
 *
 * `z.object` descarta silenciosamente chaves desconhecidas por padrão (sem
 * `.strict()`/`.passthrough()`) — cobre o edge case "áreas não previstas no
 * formulário são ignoradas". Objeto malformado (JSON inválido, não-objeto) ou
 * sem nenhum dos 5 campos reconhecidos → `null` (tratado como falha de
 * extração pelo adapter — CVE-05/CVE-MN-06).
 */
const extractedFieldsSchema = z.object({
  educationLevel: z.string().trim().min(1).nullable().optional(),
  educationArea: z.string().trim().min(1).nullable().optional(),
  experienceText: z.string().trim().min(1).nullable().optional(),
  skillsText: z.string().trim().min(1).nullable().optional(),
  coursesText: z.string().trim().min(1).nullable().optional(),
});

/**
 * Converte a saída bruta do LLM (string JSON ou objeto já parseado) nos 5
 * campos estruturados do CV. `null` sinaliza falha de extração — JSON
 * malformado, não-objeto, ou objeto sem nenhum campo reconhecido (vazio).
 */
export function parseExtractedFields(raw: unknown): CvExtractedFields | null {
  let candidate: unknown = raw;
  if (typeof raw === 'string') {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return null;
  }

  const parsed = extractedFieldsSchema.safeParse(candidate);
  if (!parsed.success) return null;

  const fields: CvExtractedFields = {
    educationLevel: parsed.data.educationLevel ?? null,
    educationArea: parsed.data.educationArea ?? null,
    experienceText: parsed.data.experienceText ?? null,
    skillsText: parsed.data.skillsText ?? null,
    coursesText: parsed.data.coursesText ?? null,
  };

  const hasAnyField = Object.values(fields).some((value) => value !== null && value !== undefined);
  return hasAnyField ? fields : null;
}
