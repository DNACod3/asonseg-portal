import { describe, it, expect } from 'vitest';
import { COMPANY_TYPES, COMPANY_TYPE_LABELS, COMPANY_TYPE_OPTIONS } from '../domain/company-type';

/**
 * Guard de completude enum↔UI (EMP055-MN-02 / must-not): o mapa de rótulos
 * PT-BR precisa cobrir EXATAMENTE os 5 valores do enum `CompanyType` — se um
 * novo valor for adicionado ao enum sem atualizar o mapa, este teste falha
 * (previne SA/LUCRO_* ficarem sem seleção visível, como no defeito EMP-4).
 */
describe('COMPANY_TYPE_LABELS (EMP055-MN-02: guard de completude enum↔UI)', () => {
  it('cobre exatamente os 5 valores do enum — sem omissão nem excesso', () => {
    expect(Object.keys(COMPANY_TYPE_LABELS).sort()).toEqual([...COMPANY_TYPES].sort());
  });

  it('cada tipo tem rótulo PT-BR não vazio', () => {
    for (const type of COMPANY_TYPES) {
      expect(COMPANY_TYPE_LABELS[type]).toBeTruthy();
    }
  });
});

describe('COMPANY_TYPE_OPTIONS', () => {
  it('mantém a ordem MEI, SIMPLES_NACIONAL, LUCRO_PRESUMIDO, LUCRO_REAL, SA', () => {
    expect(COMPANY_TYPE_OPTIONS.map((o) => o.value)).toEqual([
      'MEI',
      'SIMPLES_NACIONAL',
      'LUCRO_PRESUMIDO',
      'LUCRO_REAL',
      'SA',
    ]);
  });

  it('cada opção tem value/label correspondentes ao mapa de rótulos', () => {
    for (const opt of COMPANY_TYPE_OPTIONS) {
      expect(opt.label).toBe(COMPANY_TYPE_LABELS[opt.value]);
    }
  });
});
