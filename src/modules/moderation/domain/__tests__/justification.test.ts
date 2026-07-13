// Testes de isMeaningfulJustification (MOD-6 / P-003 / USP056-MN-02, USP056-MN-03).
// Derivados dos ACs MOD6-01/02/03 e edge cases da spec USP-056.

import { describe, it, expect } from 'vitest';
import {
  isMeaningfulJustification,
  JUSTIFICATION_NOT_MEANINGFUL_MESSAGE,
  MIN_JUSTIFICATION_LENGTH,
} from '../justification';

describe('USP-056 MOD-6 — isMeaningfulJustification exige diversidade mínima de letras', () => {
  it('[USP056-MN-02] motivo de ≥ 20 chars com um único caractere repetido → false', () => {
    expect(isMeaningfulJustification('a'.repeat(30))).toBe(false);
  });

  it('[USP056-MN-02] motivo com alfabeto curto (2 letras distintas) → false', () => {
    expect(isMeaningfulJustification('abababababababababab')).toBe(false);
  });

  it('[MOD6-01] motivo com 4 letras distintas (abaixo do limiar de 5) → false', () => {
    // 'a','b','c','d' = 4 letras distintas, repetidas até >= 20 chars.
    expect(isMeaningfulJustification('abcdabcdabcdabcdabcd')).toBe(false);
  });

  it('[USP056-MN-03 / MOD6-02] motivos legítimos reais de ≥ 20 chars → true', () => {
    expect(isMeaningfulJustification('Faltou descrever as atividades do cargo')).toBe(true);
    expect(isMeaningfulJustification('Endereço incompleto.')).toBe(true);
    expect(isMeaningfulJustification('CPF inválido no campo')).toBe(true);
  });

  it('[MOD6-02] motivo com exatamente 5 letras distintas (limiar) → true', () => {
    // 'a','b','c','d','e' = 5 letras distintas, repetidas até >= 20 chars.
    expect(isMeaningfulJustification('abcdeabcdeabcdeabcde')).toBe(true);
  });

  it('mensagem PT-BR existente permanece inalterada', () => {
    expect(JUSTIFICATION_NOT_MEANINGFUL_MESSAGE).toBe(
      'Descreva o motivo de forma significativa para o autor.',
    );
  });

  // Edge cases preservados (comportamento atual, sem regressão).
  it('null/undefined/vazio → false', () => {
    expect(isMeaningfulJustification(null)).toBe(false);
    expect(isMeaningfulJustification(undefined)).toBe(false);
    expect(isMeaningfulJustification('')).toBe(false);
  });

  it(`< ${MIN_JUSTIFICATION_LENGTH} caracteres → false mesmo com letras diversas`, () => {
    expect(isMeaningfulJustification('abcde')).toBe(false);
  });

  it('só pontuação/espaços/traços → false', () => {
    expect(isMeaningfulJustification('------------------------')).toBe(false);
    expect(isMeaningfulJustification('                        ')).toBe(false);
  });

  it('acentuação é normalizada ao contar letras distintas (NFD)', () => {
    // 'á'→'a', 'é'→'e' etc. após NFD: 5 letras-base distintas (a,e,i,o,u), 23 chars.
    expect(isMeaningfulJustification('áéíóú áéíóú áéíóú áéíóú')).toBe(true);
  });
});
