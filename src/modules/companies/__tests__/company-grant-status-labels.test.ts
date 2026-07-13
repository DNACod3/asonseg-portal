import { describe, expect, it } from 'vitest';
import { COMPANY_GRANT_STATUS_LABELS } from '../domain/company-grant-status-labels';

/**
 * USP-059 — SOC4-3: cobertura 1:1 de todos os valores de `CompanyGrantStatus`.
 */
describe('COMPANY_GRANT_STATUS_LABELS — mapeamento completo de CompanyGrantStatus (SOC4-3)', () => {
  it('cobre PENDING e ACTIVE com os rótulos PT-BR esperados', () => {
    expect(COMPANY_GRANT_STATUS_LABELS.PENDING).toBe('Pendente');
    expect(COMPANY_GRANT_STATUS_LABELS.ACTIVE).toBe('Ativo');
  });

  it('não tem chave a mais nem a menos que os 2 valores de CompanyGrantStatus', () => {
    expect(Object.keys(COMPANY_GRANT_STATUS_LABELS).sort()).toEqual(['ACTIVE', 'PENDING']);
  });
});
