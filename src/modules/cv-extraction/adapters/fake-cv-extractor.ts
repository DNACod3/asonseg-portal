import type {
  CVExtractor,
  CvExtractionInput,
  CvExtractionResult,
} from '../ports/cv-extractor.port';

const DEFAULT_RESULT: CvExtractionResult = {
  ok: true,
  fields: {
    educationLevel: 'ENSINO_MEDIO',
    educationArea: null,
    experienceText: null,
    skillsText: null,
    coursesText: null,
  },
  usage: {
    inputTokens: 100,
    outputTokens: 50,
    durationMs: 10,
    estimatedCostUsd: 0.001,
    model: 'fake',
  },
};

/**
 * Adapter determinístico de `CVExtractor` para unit/integração/E2E — nunca
 * chama o provedor real. Resultado configurável via construtor ou
 * {@link FakeCVExtractor.setResult} (útil quando o teste precisa alternar o
 * resultado entre chamadas, ex.: guarda de revogação de consentimento).
 */
export class FakeCVExtractor implements CVExtractor {
  private result: CvExtractionResult;

  constructor(result: CvExtractionResult = DEFAULT_RESULT) {
    this.result = result;
  }

  /** Troca o resultado configurado para a próxima chamada de {@link extract}. */
  setResult(result: CvExtractionResult): void {
    this.result = result;
  }

  async extract(_input: CvExtractionInput): Promise<CvExtractionResult> {
    return this.result;
  }
}
