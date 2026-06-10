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

// E-mail transacional (IDN-12 / USP-005): porta EmailSender → adapter Resend.
import { EMAIL_SENDER_TOKEN } from '@/shared/lib/email/email-sender.port';
import { ResendEmailSender } from '@/shared/lib/email/resend-email-sender';
container.register(EMAIL_SENDER_TOKEN, () => new ResendEmailSender());

// Único responsável de Empresa na inativação de Pessoa (USP-007 / AC-007-3 /
// P-002). USP-012 implementou o módulo `companies` — substituímos o adapter nulo
// pelo adapter real que consulta person_company_grants no banco.
// eslint-disable-next-line no-restricted-imports
import { COMPANY_RESPONSIBILITY_TOKEN } from '@/modules/persons/ports/companyResponsibility';
// eslint-disable-next-line no-restricted-imports
import { PrismaCompanyResponsibilityAdapter } from '@/modules/companies/adapters/prisma-company-responsibility';
container.register(COMPANY_RESPONSIBILITY_TOKEN, () => new PrismaCompanyResponsibilityAdapter());

// Moderação (USP-016 / ADR-0011): ports da máquina de estados `transitionContent`.
// ContentStatusRepository → adapter sobre `_moderation_fixture` (1º tipo a aterrissar,
// GAP-8). Notification/CompanyVerify são stubs no-op (GAP-3 → USP-044, GAP-4 → USP-017);
// cache é o adapter real do Next (ADR-T-0013). Imports profundos para não carregar
// `transition-content` (que importa este container) durante a inicialização — evita ciclo.
/* eslint-disable no-restricted-imports */
import { CONTENT_STATUS_REPOSITORY_TOKEN } from '@/modules/moderation/ports/content-status.port';
import { MODERATION_NOTIFICATION_TOKEN } from '@/modules/moderation/ports/moderation-notification.port';
import { CACHE_INVALIDATION_TOKEN } from '@/modules/moderation/ports/cache-invalidation.port';
import { COMPANY_VERIFY_HOOK_TOKEN } from '@/modules/moderation/ports/company-verify-hook.port';
import { PrismaModerationContentRepository } from '@/modules/moderation/adapters/prisma-moderation-content-repository';
import { StubModerationNotification } from '@/modules/moderation/adapters/stub-moderation-notification';
import { NextCacheInvalidation } from '@/modules/moderation/adapters/next-cache-invalidation';
import { StubCompanyVerifyHook } from '@/modules/moderation/adapters/stub-company-verify-hook';
/* eslint-enable no-restricted-imports */
container.register(CONTENT_STATUS_REPOSITORY_TOKEN, () => new PrismaModerationContentRepository());
container.register(MODERATION_NOTIFICATION_TOKEN, () => new StubModerationNotification());
container.register(CACHE_INVALIDATION_TOKEN, () => new NextCacheInvalidation());
container.register(COMPANY_VERIFY_HOOK_TOKEN, () => new StubCompanyVerifyHook());
