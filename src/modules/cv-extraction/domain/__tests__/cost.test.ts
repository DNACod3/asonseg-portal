import { describe, it, expect } from 'vitest';
import { estimateExtractionCostUsd } from '../cost';

/**
 * Custo estimado de uma extração (USP-040 / CVE-08, T6). Tarifa verificada
 * via skill `claude-api`: `claude-sonnet-4-6` = $3.00/1M input, $15.00/1M output.
 */
describe('cv-extraction/domain/cost — estimateExtractionCostUsd', () => {
  it('calcula custo = input×tarifa_input + output×tarifa_output (claude-sonnet-4-6)', () => {
    const cost = estimateExtractionCostUsd(
      { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      'claude-sonnet-4-6',
    );
    expect(cost).toBeCloseTo(3.0 + 15.0, 10);
  });

  it('calcula custo proporcional para volumes menores', () => {
    const cost = estimateExtractionCostUsd(
      { inputTokens: 1000, outputTokens: 500 },
      'claude-sonnet-4-6',
    );
    // 1000/1e6*3 + 500/1e6*15 = 0.003 + 0.0075
    expect(cost).toBeCloseTo(0.0105, 10);
  });

  it('zero tokens → custo zero', () => {
    expect(
      estimateExtractionCostUsd({ inputTokens: 0, outputTokens: 0 }, 'claude-sonnet-4-6'),
    ).toBe(0);
  });

  it('modelo desconhecido cai no fallback conservador (default) sem lançar', () => {
    expect(() =>
      estimateExtractionCostUsd({ inputTokens: 1000, outputTokens: 1000 }, 'modelo-futuro-x'),
    ).not.toThrow();
    const cost = estimateExtractionCostUsd(
      { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      'modelo-futuro-x',
    );
    expect(cost).toBeCloseTo(3.0 + 15.0, 10); // mesma tarifa do default (claude-sonnet-4-6)
  });
});
