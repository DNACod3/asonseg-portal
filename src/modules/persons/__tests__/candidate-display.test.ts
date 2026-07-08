import { describe, it, expect } from 'vitest';
import { firstNameOf } from '../domain/candidate-display';

/**
 * `firstNameOf` (USP-028 / USP028-MN-02) — o View Model de busca depende deste
 * helper para NUNCA emitir o nome completo do candidato. Cobre todas as
 * branches: vazio, único token, múltiplos tokens, espaços múltiplos, acentos.
 */
describe('firstNameOf', () => {
  it('string vazia retorna string vazia', () => {
    expect(firstNameOf('')).toBe('');
  });

  it('string só com espaços retorna string vazia', () => {
    expect(firstNameOf('   ')).toBe('');
  });

  it('único token retorna o próprio token', () => {
    expect(firstNameOf('Maria')).toBe('Maria');
  });

  it('múltiplos tokens retorna só o primeiro', () => {
    expect(firstNameOf('Maria Silva Souza')).toBe('Maria');
  });

  it('espaços múltiplos entre tokens são ignorados', () => {
    expect(firstNameOf('Maria    Silva')).toBe('Maria');
  });

  it('espaços nas bordas são removidos antes de tokenizar', () => {
    expect(firstNameOf('  João Pedro  ')).toBe('João');
  });

  it('preserva acentos no primeiro nome', () => {
    expect(firstNameOf('José António Núñez')).toBe('José');
  });
});
