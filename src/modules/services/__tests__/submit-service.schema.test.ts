import { describe, it, expect } from 'vitest';
import { publishServiceSchema, draftServiceSchema } from '../schemas/publish-service.schema';

/**
 * FACTS (USP-029 / T029-5) — validação Zod da faixa de valor e dos campos
 * obrigatórios no submit (AC-029-3), espelhando `publish-job.schema.spec.ts`.
 * Regra pura (sem IO).
 */

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const COMPANY_ID = '33333333-3333-4333-8333-333333333333';

/** Input completo e válido de submissão (publishServiceSchema) — publicação como PF. */
function validPublishInput(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Jardinagem residencial',
    categoryId: CATEGORY_ID,
    description: 'Poda, manutenção de grama e jardins residenciais.',
    priceMin: 80,
    priceMax: 150,
    priceUnit: 'por serviço',
    regionId: REGION_ID,
    availabilityDescription: 'Segunda a sexta, 8h às 17h.',
    ...overrides,
  };
}

describe('publishServiceSchema — happy path e faixa de valor', () => {
  it('aceita um input completo e válido como PF (companyId ausente)', () => {
    const parsed = publishServiceSchema.safeParse(validPublishInput());
    expect(parsed.success).toBe(true);
  });

  it('aceita publicar em nome de Empresa (companyId setado)', () => {
    const parsed = publishServiceSchema.safeParse(validPublishInput({ companyId: COMPANY_ID }));
    expect(parsed.success).toBe(true);
  });

  it("preprocessa companyId '' (sentinela do select PF) para undefined — não trava o submit de PF", () => {
    const parsed = publishServiceSchema.safeParse(validPublishInput({ companyId: '' }));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.companyId).toBeUndefined();
    }
  });

  it("preprocessa priceMin/priceMax '' (vazio) para undefined", () => {
    const parsed = publishServiceSchema.safeParse(
      validPublishInput({ priceMin: '', priceMax: '' }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.priceMin).toBeUndefined();
      expect(parsed.data.priceMax).toBeUndefined();
    }
  });

  it('coage valor em string para número', () => {
    const parsed = publishServiceSchema.safeParse(
      validPublishInput({ priceMin: '80', priceMax: '150' }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.priceMin).toBe(80);
      expect(parsed.data.priceMax).toBe(150);
    }
  });

  it('rejeita valor negativo', () => {
    const parsed = publishServiceSchema.safeParse(validPublishInput({ priceMin: -1 }));
    expect(parsed.success).toBe(false);
  });

  it('rejeita priceMax menor que priceMin (superRefine)', () => {
    const parsed = publishServiceSchema.safeParse(
      validPublishInput({ priceMin: 150, priceMax: 80 }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('priceMax'))).toBe(true);
    }
  });
});

describe('publishServiceSchema — campos obrigatórios no submit (AC-029-3)', () => {
  it.each(['title', 'categoryId', 'description', 'priceUnit', 'regionId', 'availabilityDescription'])(
    'exige "%s" no submit',
    (campo) => {
      const input = validPublishInput();
      delete (input as Record<string, unknown>)[campo];
      const parsed = publishServiceSchema.safeParse(input);
      expect(parsed.success).toBe(false);
    },
  );

  it('rejeita regionId que não é uuid', () => {
    expect(
      publishServiceSchema.safeParse(validPublishInput({ regionId: 'nao-uuid' })).success,
    ).toBe(false);
  });

  it('rejeita mais de 3 caminhos de foto', () => {
    const parsed = publishServiceSchema.safeParse(
      validPublishInput({ photoStoragePaths: ['a', 'b', 'c', 'd'] }),
    );
    expect(parsed.success).toBe(false);
  });
});

describe('draftServiceSchema — campos opcionais no rascunho (AC-029-3)', () => {
  it('aceita rascunho só com title (sem categoria/valor/região/disponibilidade)', () => {
    const parsed = draftServiceSchema.safeParse({ title: 'Rascunho' });
    expect(parsed.success).toBe(true);
  });

  it('aceita rascunho com companyId setado (em nome de Empresa)', () => {
    const parsed = draftServiceSchema.safeParse({ title: 'Rascunho', companyId: COMPANY_ID });
    expect(parsed.success).toBe(true);
  });

  it('rejeita title abaixo do mínimo', () => {
    const parsed = draftServiceSchema.safeParse({ title: 'a' });
    expect(parsed.success).toBe(false);
  });
});
