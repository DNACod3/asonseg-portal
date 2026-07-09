import { describe, it, expect } from 'vitest';
import { createReferralSchema } from '../schemas/referral.schema';

/**
 * Unit tests de `createReferralSchema` (USP-037 / T2). A obrigatoriedade
 * condicional do resumo profissional (REF-MN-03) NÃO é responsabilidade deste
 * schema (depende de dado do DB — validada na action); aqui só validamos forma.
 */

const VALID_PERSON_ID = '11111111-1111-4111-8111-111111111111';
const VALID_JOB_ID = '22222222-2222-4222-8222-222222222222';

describe('createReferralSchema', () => {
  it('aceita input mínimo válido (só personId + jobId)', () => {
    const result = createReferralSchema.safeParse({ personId: VALID_PERSON_ID, jobId: VALID_JOB_ID });
    expect(result.success).toBe(true);
  });

  it('aceita input completo válido (resumo + motivo)', () => {
    const result = createReferralSchema.safeParse({
      personId: VALID_PERSON_ID,
      jobId: VALID_JOB_ID,
      professionalSummary: 'Experiência em vendas e atendimento ao público.',
      justification: 'Perfil alinhado ao requisito da vaga.',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita personId com uuid inválido', () => {
    const result = createReferralSchema.safeParse({ personId: 'not-a-uuid', jobId: VALID_JOB_ID });
    expect(result.success).toBe(false);
  });

  it('rejeita jobId com uuid inválido', () => {
    const result = createReferralSchema.safeParse({ personId: VALID_PERSON_ID, jobId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejeita resumo profissional vazio-quando-informado (só espaços)', () => {
    const result = createReferralSchema.safeParse({
      personId: VALID_PERSON_ID,
      jobId: VALID_JOB_ID,
      professionalSummary: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita motivo acima do máximo (1000 caracteres)', () => {
    const result = createReferralSchema.safeParse({
      personId: VALID_PERSON_ID,
      jobId: VALID_JOB_ID,
      justification: 'a'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it('rejeita resumo profissional acima do máximo (2000 caracteres)', () => {
    const result = createReferralSchema.safeParse({
      personId: VALID_PERSON_ID,
      jobId: VALID_JOB_ID,
      professionalSummary: 'a'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});
