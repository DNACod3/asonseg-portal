import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Adapter Anthropic de `CVExtractor` (USP-040, T8). SDK mockado
 * (`vi.mock('@anthropic-ai/sdk')`) — sem chamada real. Cobre: PDF→bloco
 * `document`; DOCX→bloco de texto (via `mammoth` mockado); mapeamento de
 * `usage.input_tokens/output_tokens`→custo; SDK lançando→`ok:false
 * PROVIDER_ERROR`; JSON malformado→`ok:false MALFORMED` — nunca lança.
 */

const createMock = vi.hoisted(() => vi.fn());
vi.mock('@anthropic-ai/sdk', () => ({
  default: class FakeAnthropicClient {
    messages = { create: createMock };
  },
}));

const extractRawTextMock = vi.hoisted(() => vi.fn());
vi.mock('mammoth', () => ({
  default: { extractRawText: extractRawTextMock },
}));

const { AnthropicCVExtractor } = await import('../anthropic-cv-extractor');

function okSdkResponse(jsonText: string, inputTokens = 1000, outputTokens = 100) {
  return {
    content: [{ type: 'text', text: jsonText }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

describe('cv-extraction/adapters/anthropic-cv-extractor — AnthropicCVExtractor', () => {
  beforeEach(() => {
    createMock.mockReset();
    extractRawTextMock.mockReset();
  });

  it('PDF: monta bloco document (base64) e retorna campos + usage/custo mapeados', async () => {
    createMock.mockResolvedValue(
      okSdkResponse(
        JSON.stringify({
          educationLevel: 'ENSINO_SUPERIOR',
          educationArea: 'Administração',
          experienceText: null,
          skillsText: null,
          coursesText: null,
        }),
        2000,
        300,
      ),
    );

    const extractor = new AnthropicCVExtractor();
    const result = await extractor.extract({
      content: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      mimeType: 'pdf',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.educationLevel).toBe('ENSINO_SUPERIOR');
    expect(result.usage.inputTokens).toBe(2000);
    expect(result.usage.outputTokens).toBe(300);
    expect(result.usage.estimatedCostUsd).toBeGreaterThan(0);
    expect(result.usage.model).toBe('claude-sonnet-4-6');

    // Bloco enviado ao SDK deve ser do tipo `document` com source base64.
    const callArgs = createMock.mock.calls[0]?.[0];
    const content = callArgs.messages[0].content;
    expect(content[0]).toMatchObject({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf' },
    });
  });

  it('DOCX: converte via mammoth e envia bloco de texto', async () => {
    extractRawTextMock.mockResolvedValue({ value: 'Texto extraído do DOCX', messages: [] });
    createMock.mockResolvedValue(
      okSdkResponse(JSON.stringify({ educationLevel: 'ENSINO_MEDIO' })),
    );

    const extractor = new AnthropicCVExtractor();
    const result = await extractor.extract({
      content: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      mimeType: 'docx',
    });

    expect(result.ok).toBe(true);
    expect(extractRawTextMock).toHaveBeenCalledOnce();
    const callArgs = createMock.mock.calls[0]?.[0];
    const content = callArgs.messages[0].content;
    expect(content[0]).toMatchObject({ type: 'text', text: 'Texto extraído do DOCX' });
  });

  it('SDK lança erro → ok:false PROVIDER_ERROR (nunca lança)', async () => {
    createMock.mockRejectedValue(new Error('network timeout'));

    const extractor = new AnthropicCVExtractor();
    const result = await extractor.extract({
      content: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      mimeType: 'pdf',
    });

    expect(result).toEqual({ ok: false, reason: 'PROVIDER_ERROR' });
  });

  it('JSON malformado na resposta → ok:false MALFORMED', async () => {
    createMock.mockResolvedValue(okSdkResponse('isto não é json'));

    const extractor = new AnthropicCVExtractor();
    const result = await extractor.extract({
      content: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      mimeType: 'pdf',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('MALFORMED');
  });

  it('DOCX sem texto extraível → ok:false EMPTY sem chamar o SDK', async () => {
    extractRawTextMock.mockResolvedValue({ value: '   ', messages: [] });

    const extractor = new AnthropicCVExtractor();
    const result = await extractor.extract({
      content: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      mimeType: 'docx',
    });

    expect(result).toEqual({ ok: false, reason: 'EMPTY' });
    expect(createMock).not.toHaveBeenCalled();
  });
});
