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

// ── Bindings de produção ──────────────────────────────────────────────────────
// Importações lazy (dentro do if) para evitar inicialização em módulos de teste
// que façam register() com fakes antes de qualquer import deste arquivo.
// O pattern é: importar o token (sem IO) e registrar a factory (sem instanciar).

// Importações via caminhos profundos são necessárias aqui para evitar
// dependência circular: barrel → registerPerson → container → barrel.
// eslint-disable-next-line no-restricted-imports
import { CAPTCHA_VERIFIER_TOKEN } from '@/modules/identity/ports/captchaVerifier';
// eslint-disable-next-line no-restricted-imports
import { TurnstileCaptchaVerifier } from '@/modules/identity/adapters/turnstileCaptchaVerifier';
container.register(CAPTCHA_VERIFIER_TOKEN, () => new TurnstileCaptchaVerifier());

// Autenticação (USP-004): provedor de auth (Supabase) + repositório de tentativas.
// eslint-disable-next-line no-restricted-imports
import { AUTH_PROVIDER_TOKEN } from '@/modules/identity/ports/authProvider';
// eslint-disable-next-line no-restricted-imports
import { SupabaseAuthProvider } from '@/modules/identity/adapters/supabaseAuthProvider';
container.register(AUTH_PROVIDER_TOKEN, () => new SupabaseAuthProvider());

// eslint-disable-next-line no-restricted-imports
import { AUTH_ATTEMPTS_REPO_TOKEN } from '@/modules/identity/ports/authAttemptsRepo';
// eslint-disable-next-line no-restricted-imports
import { PrismaAuthAttemptsRepo } from '@/modules/identity/adapters/authAttemptsRepo';
container.register(AUTH_ATTEMPTS_REPO_TOKEN, () => new PrismaAuthAttemptsRepo());
