import { describe, it, expect } from 'vitest';
import { confirmCvFieldsSchema } from '../confirm-cv-fields.schema';

/**
 * Schema de `confirmCvFields` (USP-040 / CVE-04, T11).
 */
describe('cv-extraction/schemas/confirm-cv-fields — confirmCvFieldsSchema', () => {
  it('aceita input válido com os 5 campos', () => {
    const parsed = confirmCvFieldsSchema.safeParse({
      educationLevel: 'ENSINO_SUPERIOR',
      educationArea: 'Administração',
      experienceText: '5 anos como auxiliar administrativo',
      skillsText: 'Excel, atendimento ao público',
      coursesText: 'Curso de Excel avançado',
    });
    expect(parsed.success).toBe(true);
  });

  it('aceita objeto vazio (todos os campos são opcionais)', () => {
    expect(confirmCvFieldsSchema.safeParse({}).success).toBe(true);
  });

  it('rejeita educationLevel fora do enum EDUCATION_LEVELS', () => {
    const parsed = confirmCvFieldsSchema.safeParse({ educationLevel: 'DOUTORADO' });
    expect(parsed.success).toBe(false);
  });

  it('rejeita educationArea acima do limite de 120 caracteres', () => {
    const parsed = confirmCvFieldsSchema.safeParse({ educationArea: 'a'.repeat(121) });
    expect(parsed.success).toBe(false);
  });

  it('rejeita experienceText acima do limite de 5000 caracteres', () => {
    const parsed = confirmCvFieldsSchema.safeParse({ experienceText: 'a'.repeat(5001) });
    expect(parsed.success).toBe(false);
  });

  it('rejeita skillsText/coursesText acima do limite de 2000 caracteres', () => {
    expect(confirmCvFieldsSchema.safeParse({ skillsText: 'a'.repeat(2001) }).success).toBe(false);
    expect(confirmCvFieldsSchema.safeParse({ coursesText: 'a'.repeat(2001) }).success).toBe(false);
  });
});
