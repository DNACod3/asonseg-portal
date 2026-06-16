import { describe, it, expect } from 'vitest';
import { removeResponsibleSchema, MOTIVO_MAX } from '../schemas/remove-responsible.schema';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

describe('removeResponsibleSchema', () => {
  it('parseia grantId UUID sem motivo', () => {
    const result = removeResponsibleSchema.safeParse({ grantId: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.grantId).toBe(VALID_UUID);
      expect(result.data.motivo).toBeUndefined();
    }
  });

  it('aceita motivo opcional (com trim)', () => {
    const result = removeResponsibleSchema.safeParse({ grantId: VALID_UUID, motivo: '  Saiu da empresa  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.motivo).toBe('Saiu da empresa');
    }
  });

  it('normaliza motivo só-whitespace para undefined', () => {
    const result = removeResponsibleSchema.safeParse({ grantId: VALID_UUID, motivo: '   ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.motivo).toBeUndefined();
    }
  });

  it('falha com grantId que não é UUID', () => {
    const result = removeResponsibleSchema.safeParse({ grantId: 'nao-uuid' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.grantId).toBeDefined();
    }
  });

  it('falha com motivo acima do limite', () => {
    const result = removeResponsibleSchema.safeParse({
      grantId: VALID_UUID,
      motivo: 'x'.repeat(MOTIVO_MAX + 1),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.motivo).toBeDefined();
    }
  });
});
