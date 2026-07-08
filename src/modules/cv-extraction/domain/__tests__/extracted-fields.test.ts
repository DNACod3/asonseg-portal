import { describe, it, expect } from 'vitest';
import { parseExtractedFields } from '../extracted-fields';

/**
 * Parse/validação defensiva da saída do LLM (USP-040 / CVE-02/CVE-05, T5).
 * Cada caso mapeia 1:1 ao spec: JSON válido, chaves extras ignoradas (edge
 * case), JSON malformado, e objeto vazio (sem nenhum dos 5 campos).
 */
describe('cv-extraction/domain/extracted-fields — parseExtractedFields', () => {
  it('JSON válido (string) → mapeia os 5 campos estruturados', () => {
    const raw = JSON.stringify({
      educationLevel: 'ENSINO_SUPERIOR',
      educationArea: 'Administração',
      experienceText: '5 anos como auxiliar administrativo',
      skillsText: 'Excel, atendimento ao público',
      coursesText: 'Curso de Excel avançado',
    });
    expect(parseExtractedFields(raw)).toEqual({
      educationLevel: 'ENSINO_SUPERIOR',
      educationArea: 'Administração',
      experienceText: '5 anos como auxiliar administrativo',
      skillsText: 'Excel, atendimento ao público',
      coursesText: 'Curso de Excel avançado',
    });
  });

  it('objeto já parseado (não-string) com os 5 campos → mapeia normalmente', () => {
    const raw = { educationLevel: 'ENSINO_MEDIO', educationArea: null };
    expect(parseExtractedFields(raw)).toEqual({
      educationLevel: 'ENSINO_MEDIO',
      educationArea: null,
      experienceText: null,
      skillsText: null,
      coursesText: null,
    });
  });

  it('ignora chaves desconhecidas (edge case — campos fora do formulário)', () => {
    const raw = {
      educationLevel: 'ENSINO_TECNICO',
      nomeCompleto: 'Fulano de Tal', // campo não previsto — deve ser ignorado
      telefone: '11999998888', // idem
    };
    const result = parseExtractedFields(raw);
    expect(result).toEqual({
      educationLevel: 'ENSINO_TECNICO',
      educationArea: null,
      experienceText: null,
      skillsText: null,
      coursesText: null,
    });
    expect(result).not.toHaveProperty('nomeCompleto');
    expect(result).not.toHaveProperty('telefone');
  });

  it('JSON malformado (string inválida) → null', () => {
    expect(parseExtractedFields('{ isto não é json válido')).toBeNull();
  });

  it('objeto vazio (sem nenhum dos 5 campos) → null', () => {
    expect(parseExtractedFields({})).toBeNull();
  });

  it('não-objeto (array, número, null) → null', () => {
    expect(parseExtractedFields([1, 2, 3])).toBeNull();
    expect(parseExtractedFields(42)).toBeNull();
    expect(parseExtractedFields(null)).toBeNull();
  });
});
