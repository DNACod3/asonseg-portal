import { describe, it, expect } from 'vitest';
import { publishJobSchema, draftJobSchema } from '../schemas/publish-job.schema';
import { MAX_VALIDADE_DIAS } from '../domain/validade';

/**
 * FACTS (USP-021 / #170) — validação Zod da faixa salarial e da fronteira submit-vs-draft
 * dos campos de busca (E-002 / AD-5). Regra pura (sem IO), cobre os caminhos que o
 * Testing Requirements exige: happy path + falha de validação.
 */

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';

/** Data de validade futura dentro do teto, como `yyyy-MM-dd`. */
function futureDateStr(days = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Input completo e válido de submissão (publishJobSchema). */
function validPublishInput(overrides: Record<string, unknown> = {}) {
  return {
    companyId: UUID_A,
    title: 'Atendente de loja',
    areaId: UUID_B,
    description: 'Descrição da vaga.',
    requirements: 'Requisitos da vaga.',
    workRegime: 'Presencial',
    location: 'Florianópolis/SC',
    contractType: 'CLT',
    regionId: UUID_C,
    validUntil: futureDateStr(),
    ...overrides,
  };
}

describe('publishJobSchema — faixa salarial (AD-5)', () => {
  it('aceita um input completo e válido (happy path)', () => {
    const parsed = publishJobSchema.safeParse(validPublishInput());
    expect(parsed.success).toBe(true);
  });

  it("preprocessa salário '' (vazio) para undefined — campo opcional", () => {
    const parsed = publishJobSchema.safeParse(
      validPublishInput({ salaryMin: '', salaryMax: '' }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.salaryMin).toBeUndefined();
      expect(parsed.data.salaryMax).toBeUndefined();
    }
  });

  it('coage salário em string para número', () => {
    const parsed = publishJobSchema.safeParse(
      validPublishInput({ salaryMin: '2000', salaryMax: '3000' }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.salaryMin).toBe(2000);
      expect(parsed.data.salaryMax).toBe(3000);
    }
  });

  it('rejeita salário negativo', () => {
    const parsed = publishJobSchema.safeParse(validPublishInput({ salaryMin: -1 }));
    expect(parsed.success).toBe(false);
  });

  it('rejeita salário máximo menor que o mínimo (superRefine — AD-5)', () => {
    const parsed = publishJobSchema.safeParse(
      validPublishInput({ salaryMin: 3000, salaryMax: 2000 }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('salaryMax'))).toBe(true);
    }
  });

  it('aceita faixa coerente (max >= min)', () => {
    const parsed = publishJobSchema.safeParse(
      validPublishInput({ salaryMin: 2000, salaryMax: 2000 }),
    );
    expect(parsed.success).toBe(true);
  });
});

describe('publishJobSchema — campos de busca obrigatórios no submit (E-002)', () => {
  it('exige contractType no submit', () => {
    const { contractType, ...semContrato } = validPublishInput();
    void contractType;
    expect(publishJobSchema.safeParse(semContrato).success).toBe(false);
  });

  it('exige regionId no submit', () => {
    const { regionId, ...semRegiao } = validPublishInput();
    void regionId;
    expect(publishJobSchema.safeParse(semRegiao).success).toBe(false);
  });

  it('rejeita regionId que não é uuid', () => {
    expect(publishJobSchema.safeParse(validPublishInput({ regionId: 'nao-uuid' })).success).toBe(
      false,
    );
  });
});

describe('publishJobSchema — validade (E-004 / E-005)', () => {
  it('rejeita validade no passado', () => {
    const parsed = publishJobSchema.safeParse(validPublishInput({ validUntil: '2020-01-01' }));
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('validUntil'))).toBe(true);
    }
  });

  it('rejeita validade que ultrapassa o teto de dias', () => {
    const parsed = publishJobSchema.safeParse(
      validPublishInput({ validUntil: futureDateStr(MAX_VALIDADE_DIAS + 30) }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('validUntil'))).toBe(true);
    }
  });
});

describe('draftJobSchema — campos de busca opcionais no rascunho (AC-020-4)', () => {
  it('aceita rascunho só com companyId + title (sem contractType/regionId/validade)', () => {
    const parsed = draftJobSchema.safeParse({ companyId: UUID_A, title: 'Rascunho' });
    expect(parsed.success).toBe(true);
  });

  it('aplica o default salaryVisible=true', () => {
    const parsed = draftJobSchema.safeParse({ companyId: UUID_A, title: 'Rascunho' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.salaryVisible).toBe(true);
    }
  });
});
