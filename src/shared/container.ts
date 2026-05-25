/**
 * Container de injeção de dependências (CLAUDE.md): bindings ports→adapters.
 *
 * Os módulos dependem de interfaces (ports) e resolvem a implementação concreta
 * (adapter) aqui — nunca importam o adapter diretamente. Ex.: o `CVExtractor`
 * (port) é resolvido para o adapter Anthropic em produção e para um fake em teste.
 *
 * Esqueleto: os bindings reais serão registrados pelos módulos conforme forem
 * implementados (cv-extraction, audit, etc.).
 */

/** Símbolo identificador de cada port registrável. */
export type Token<T> = symbol & { __type?: T };

export function createToken<T>(description: string): Token<T> {
  return Symbol(description) as Token<T>;
}

type Factory<T> = () => T;

class Container {
  private readonly factories = new Map<symbol, Factory<unknown>>();
  private readonly singletons = new Map<symbol, unknown>();

  /** Registra a factory de um port. Sobrescreve binding anterior (útil em testes). */
  register<T>(token: Token<T>, factory: Factory<T>): void {
    this.factories.set(token, factory);
    this.singletons.delete(token);
  }

  /** Resolve o adapter de um port (lazy + memoizado por token). */
  resolve<T>(token: Token<T>): T {
    if (this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }
    const factory = this.factories.get(token);
    if (!factory) {
      throw new Error(`Nenhum adapter registrado para o port "${token.description ?? '?'}".`);
    }
    const instance = factory();
    this.singletons.set(token, instance);
    return instance as T;
  }

  /** Limpa bindings e instâncias — usado por setup de testes. */
  reset(): void {
    this.factories.clear();
    this.singletons.clear();
  }
}

export const container = new Container();
