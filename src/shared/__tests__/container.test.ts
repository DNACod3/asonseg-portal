import { describe, it, expect, beforeEach } from 'vitest';
import { container, createToken } from '@/shared/container';

interface Greeter {
  hi(): string;
}

const GreeterToken = createToken<Greeter>('Greeter');

describe('shared/container', () => {
  beforeEach(() => container.reset());

  it('resolve um adapter registrado', () => {
    container.register(GreeterToken, () => ({ hi: () => 'olá' }));
    expect(container.resolve(GreeterToken).hi()).toBe('olá');
  });

  it('memoiza a instância (mesma referência entre resolves)', () => {
    container.register(GreeterToken, () => ({ hi: () => 'olá' }));
    expect(container.resolve(GreeterToken)).toBe(container.resolve(GreeterToken));
  });

  it('lança quando o port não tem adapter', () => {
    expect(() => container.resolve(GreeterToken)).toThrow(/Nenhum adapter registrado/);
  });

  it('reset limpa os bindings', () => {
    container.register(GreeterToken, () => ({ hi: () => 'olá' }));
    container.reset();
    expect(() => container.resolve(GreeterToken)).toThrow();
  });
});
