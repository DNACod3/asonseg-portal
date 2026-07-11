import { describe, it, expect } from 'vitest';
import { maskCpf } from '../domain/cpf-mask';

/**
 * USP-049 — PERFIL-01 (parte CPF): `maskCpf` revela só os 2 últimos dígitos do
 * CPF do titular (`***.***.***-NN`), nunca mais que isso — anti shoulder-surfing
 * em computador compartilhado (AUTH-4 / Assumptions).
 */
describe('maskCpf', () => {
  it('mascara CPF de 11 dígitos revelando só os 2 finais', () => {
    expect(maskCpf('12345678909')).toBe('***.***.***-09');
  });

  it('normaliza CPF com pontuação/máscara antes de mascarar', () => {
    expect(maskCpf('123.456.789-09')).toBe('***.***.***-09');
  });

  it('normaliza CPF com espaços/outros separadores não-dígitos', () => {
    expect(maskCpf('123 456 789 09')).toBe('***.***.***-09');
  });

  it('entrada malformada (menos de 11 dígitos) nunca vaza dígitos', () => {
    expect(maskCpf('123')).toBe('***.***.***-**');
  });

  it('entrada malformada (mais de 11 dígitos) nunca vaza dígitos', () => {
    expect(maskCpf('123456789099999')).toBe('***.***.***-**');
  });

  it('entrada vazia nunca vaza dígitos', () => {
    expect(maskCpf('')).toBe('***.***.***-**');
  });
});
