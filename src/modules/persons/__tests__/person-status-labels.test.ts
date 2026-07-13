import { describe, expect, it } from 'vitest';
import { PERSON_STATUS_LABELS } from '../domain/person-status-labels';

/**
 * USP-059 — SOC4-2: cobertura 1:1 de todos os valores de `PersonStatus`.
 */
describe('PERSON_STATUS_LABELS — mapeamento completo de PersonStatus (SOC4-2)', () => {
  it('cobre ATIVO e INATIVO com os rótulos PT-BR esperados', () => {
    expect(PERSON_STATUS_LABELS.ATIVO).toBe('Ativa');
    expect(PERSON_STATUS_LABELS.INATIVO).toBe('Inativa');
  });

  it('não tem chave a mais nem a menos que os 2 valores de PersonStatus', () => {
    expect(Object.keys(PERSON_STATUS_LABELS).sort()).toEqual(['ATIVO', 'INATIVO']);
  });
});
