import { describe, it, expect } from 'vitest';
import { FakeCVExtractor } from '../fake-cv-extractor';

/**
 * Adapter fake de teste/E2E (USP-040, T7) — determinístico, sem chamada real.
 */
describe('cv-extraction/adapters/fake-cv-extractor — FakeCVExtractor', () => {
  it('retorna o resultado default (ok:true) quando nenhum é configurado', async () => {
    const fake = new FakeCVExtractor();
    const result = await fake.extract({ content: new Uint8Array(), mimeType: 'pdf' });
    expect(result.ok).toBe(true);
  });

  it('retorna o resultado ok configurado no construtor', async () => {
    const configured = {
      ok: true as const,
      fields: {
        educationLevel: 'ENSINO_SUPERIOR',
        educationArea: 'Administração',
        experienceText: null,
        skillsText: null,
        coursesText: null,
      },
      usage: {
        inputTokens: 500,
        outputTokens: 200,
        durationMs: 1200,
        estimatedCostUsd: 0.005,
        model: 'claude-sonnet-4-6',
      },
    };
    const fake = new FakeCVExtractor(configured);
    const result = await fake.extract({ content: new Uint8Array(), mimeType: 'pdf' });
    expect(result).toEqual(configured);
  });

  it('retorna ok:false quando configurado via setResult (simula falha de extração)', async () => {
    const fake = new FakeCVExtractor();
    fake.setResult({ ok: false, reason: 'MALFORMED' });
    const result = await fake.extract({ content: new Uint8Array(), mimeType: 'docx' });
    expect(result).toEqual({ ok: false, reason: 'MALFORMED' });
  });
});
