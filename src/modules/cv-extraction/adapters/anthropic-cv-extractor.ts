// Único arquivo de `src/` autorizado a importar o SDK do provedor (CVE-MN-05);
// guarda estática em `__tests__/no-external-llm-sdk.test.ts`.
import Anthropic from '@anthropic-ai/sdk';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages';
import mammoth from 'mammoth';
import { env } from '@/shared/env';
import { EDUCATION_LEVELS } from '@/modules/persons';
import type {
  CVExtractor,
  CvExtractionInput,
  CvExtractionResult,
  CvExtractionUsage,
} from '../ports/cv-extractor.port';
import { parseExtractedFields } from '../domain/extracted-fields';
import { estimateExtractionCostUsd } from '../domain/cost';

/**
 * Adapter Anthropic de `CVExtractor` (USP-040 / ADR-0012) — **único** arquivo
 * de `src/` autorizado a importar `@anthropic-ai/sdk` (guarda estática
 * CVE-MN-05). PDF vai nativo como bloco `document`; DOCX é convertido para
 * texto via `mammoth`; DOC legado é best-effort (heurística de extração de
 * texto imprimível — pode falhar, cai no fallback gracioso).
 *
 * Sonnet 4.6 não suporta `output_config.format` (structured outputs) — o
 * prompt instrui JSON estrito e a resposta passa por parse defensivo
 * (`parseExtractedFields`) + Zod. **Nunca lança**: qualquer erro do SDK, de
 * conversão de arquivo, ou de parse vira `{ ok: false, reason }` (CVE-05 /
 * CVE-MN-06) — é essa captura que torna o fallback gracioso estruturalmente
 * garantido, não uma convenção que o consumidor precisa lembrar.
 */
const MAX_OUTPUT_TOKENS = 1024;

const EXTRACTION_PROMPT = `Você é um extrator de dados de currículos (CVs). Analise o documento anexo e extraia SOMENTE os 5 campos abaixo, respondendo com um único objeto JSON válido, sem nenhum texto antes ou depois:

{
  "educationLevel": "<um destes valores exatos: ${EDUCATION_LEVELS.join(', ')}, ou null se não identificável>",
  "educationArea": "<área de formação, texto livre, ou null>",
  "experienceText": "<resumo da experiência profissional, texto livre, ou null>",
  "skillsText": "<habilidades, texto livre, ou null>",
  "coursesText": "<cursos complementares, texto livre, ou null>"
}

Não invente informações que não estão no documento. Se um campo não puder ser identificado, use null. Responda apenas com o JSON — nenhuma explicação, nenhum markdown.`;

/** Extração best-effort de texto imprimível de um `.doc` (OLE2) sem parser dedicado. */
function bestEffortExtractDocText(buffer: Buffer): string {
  const matches = buffer.toString('latin1').match(/[\x20-\x7E]{4,}/g) ?? [];
  return matches.join(' ').trim();
}

export class AnthropicCVExtractor implements CVExtractor {
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  async extract(input: CvExtractionInput): Promise<CvExtractionResult> {
    const startedAt = Date.now();

    try {
      const documentBlock = await this.buildDocumentBlock(input);
      if (documentBlock === null) {
        return { ok: false, reason: 'EMPTY' };
      }

      const response = await this.client.messages.create({
        model: env.ANTHROPIC_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          {
            role: 'user',
            content: [documentBlock, { type: 'text', text: EXTRACTION_PROMPT }],
          },
        ],
      });

      const durationMs = Date.now() - startedAt;
      const usage: CvExtractionUsage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        durationMs,
        model: env.ANTHROPIC_MODEL,
        estimatedCostUsd: estimateExtractionCostUsd(
          { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
          env.ANTHROPIC_MODEL,
        ),
      };

      const textBlock = response.content.find(
        (block): block is Extract<(typeof response.content)[number], { type: 'text' }> =>
          block.type === 'text',
      );
      if (!textBlock) {
        return { ok: false, reason: 'MALFORMED', usage };
      }

      const fields = parseExtractedFields(textBlock.text);
      if (fields === null) {
        return { ok: false, reason: 'MALFORMED', usage };
      }

      return { ok: true, fields, usage };
    } catch {
      // SDK/rede/timeout/qualquer erro inesperado: nunca propaga (CVE-05/CVE-MN-06).
      return { ok: false, reason: 'PROVIDER_ERROR' };
    }
  }

  /** Monta o bloco de conteúdo por MIME; `null` quando não há nada extraível (→ EMPTY). */
  private async buildDocumentBlock(input: CvExtractionInput): Promise<ContentBlockParam | null> {
    const buffer = Buffer.from(input.content);

    switch (input.mimeType) {
      case 'pdf':
        return {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: buffer.toString('base64'),
          },
        };
      case 'docx': {
        const { value } = await mammoth.extractRawText({ buffer });
        const text = value.trim();
        return text ? { type: 'text', text } : null;
      }
      case 'doc': {
        const text = bestEffortExtractDocText(buffer);
        return text ? { type: 'text', text } : null;
      }
      default:
        return null;
    }
  }
}
