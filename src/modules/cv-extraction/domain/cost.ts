import type { CvExtractionUsage } from '../ports/cv-extractor.port';

/**
 * Estimativa de custo de uma chamada de extração de CV (USP-040 / CVE-08).
 * Regra pura, sem IO — tabela de tarifa por modelo (USD por 1M tokens),
 * verificada via skill `claude-api` (preços correntes do provedor).
 *
 * Modelo desconhecido (ex.: troca de `env.ANTHROPIC_MODEL` para um modelo
 * ainda não tarifado aqui) não lança — cai no fallback conservador do
 * modelo default, para nunca quebrar a auditoria de custo por falta de tarifa.
 */
interface ModelPricingUsdPerMillionTokens {
  readonly input: number;
  readonly output: number;
}

/** Tarifa default (fallback) — mesma do modelo `claude-sonnet-4-6`. */
const DEFAULT_PRICING: ModelPricingUsdPerMillionTokens = { input: 3.0, output: 15.0 };

const MODEL_PRICING: Record<string, ModelPricingUsdPerMillionTokens> = {
  'claude-sonnet-4-6': DEFAULT_PRICING,
};

/**
 * Custo estimado (USD) de uma extração, a partir dos tokens de input/output
 * e do modelo usado. `usage` aceita o subconjunto `inputTokens`/`outputTokens`
 * de {@link CvExtractionUsage} (o adapter monta o restante do objeto).
 */
export function estimateExtractionCostUsd(
  usage: Pick<CvExtractionUsage, 'inputTokens' | 'outputTokens'>,
  model: string,
): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}
