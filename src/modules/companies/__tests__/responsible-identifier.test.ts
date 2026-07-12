import { describe, it, expect } from 'vitest';
import { classifyIdentifier } from '../domain/responsible-identifier';

/**
 * Testes do classificador client-safe de "CPF ou e-mail" (USP-055 / EMP-8),
 * relocado de `schemas/add-responsible.schema.ts`. Comportamento idêntico ao
 * anterior (mesmos vereditos CPF/e-mail/`null`).
 */
describe('classifyIdentifier', () => {
  it('reconhece CPF válido (com máscara) e normaliza para dígitos', () => {
    expect(classifyIdentifier('529.982.247-25')).toEqual({ kind: 'cpf', value: '52998224725' });
  });

  it('reconhece CPF válido (só dígitos)', () => {
    expect(classifyIdentifier('52998224725')).toEqual({ kind: 'cpf', value: '52998224725' });
  });

  it('rejeita CPF mal formatado (dígito verificador errado) — retorna null', () => {
    expect(classifyIdentifier('123')).toBeNull();
    expect(classifyIdentifier('111.111.111-11')).toBeNull();
  });

  it('reconhece e-mail válido e normaliza para lowercase+trim', () => {
    expect(classifyIdentifier(' Fulano@Example.com ')).toEqual({
      kind: 'email',
      value: 'fulano@example.com',
    });
  });

  it('rejeita e-mail mal formatado (contém "@" mas inválido) — retorna null', () => {
    expect(classifyIdentifier('fulano@')).toBeNull();
  });

  it('retorna null para valor vazio', () => {
    expect(classifyIdentifier('')).toBeNull();
  });
});
