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

// E-mail transacional (IDN-12 / USP-005): porta EmailSender → adapter Resend
// em produção; `DevSmtpEmailSender` (Mailpit local) só sob `env.EMAIL_DEV_SMTP`
// (USP-060 / HYG-05) — mesmo seam do CV extractor abaixo, guardado por
// `VERCEL_ENV` em `shared/env.ts` (HYG-MN-04 — nunca ativo em deploy real).
import { env } from '@/shared/env';
import { EMAIL_SENDER_TOKEN } from '@/shared/lib/email/email-sender.port';
import { ResendEmailSender } from '@/shared/lib/email/resend-email-sender';
import { DevSmtpEmailSender } from '@/shared/lib/email/dev-smtp-email-sender';
container.register(EMAIL_SENDER_TOKEN, () =>
  env.EMAIL_DEV_SMTP ? new DevSmtpEmailSender() : new ResendEmailSender(),
);

// Dispatcher assíncrono do Outbox (USP-044): hidratador do payload leve
// {kind:'JOB_EXPIRY_D3'} → EmailMessage. `shared` não importa `jobs`
// diretamente (TD §2.5); import profundo aqui é o padrão despacho-por-tipo
// (precedente DispatchingContentStatusRepository acima).
import { JOB_EXPIRY_EMAIL_RESOLVER_TOKEN } from '@/shared/lib/outbox/job-expiry-resolver.port';
// eslint-disable-next-line no-restricted-imports
import { resolveJobExpiryEmail } from '@/modules/jobs/queries/resolve-job-expiry-email';
container.register(JOB_EXPIRY_EMAIL_RESOLVER_TOKEN, () => resolveJobExpiryEmail);

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
// GAP-8). Notification enfileira e-mail de decisão no Outbox (GAP-3 → USP-057);
// CompanyVerify já é o adapter real (USP-017) e cache é o adapter real do Next
// (ADR-T-0013). Imports profundos para não carregar `transition-content` (que
// importa este container) durante a inicialização — evita ciclo.
/* eslint-disable no-restricted-imports */
import { CONTENT_STATUS_REPOSITORY_TOKEN } from '@/modules/moderation/ports/content-status.port';
import { MODERATION_NOTIFICATION_TOKEN } from '@/modules/moderation/ports/moderation-notification.port';
import { CACHE_INVALIDATION_TOKEN } from '@/modules/moderation/ports/cache-invalidation.port';
import { COMPANY_VERIFY_HOOK_TOKEN } from '@/modules/moderation/ports/company-verify-hook.port';
import { PrismaModerationContentRepository } from '@/modules/moderation/adapters/prisma-moderation-content-repository';
import { DispatchingContentStatusRepository } from '@/modules/moderation/adapters/dispatching-content-status-repository';
import { ContentKind } from '@/modules/moderation/domain/content-status';
import { OutboxModerationNotification } from '@/modules/moderation/adapters/outbox-moderation-notification';
import { NextCacheInvalidation } from '@/modules/moderation/adapters/next-cache-invalidation';
import { PrismaCompanyVerifyHook } from '@/modules/moderation/adapters/prisma-company-verify-hook';
import { PrismaCandidateProfileStatusRepository } from '@/modules/persons/adapters/prisma-candidate-profile-status';
import { PrismaJobStatusRepository } from '@/modules/jobs/adapters/prisma-job-status';
import { PrismaServiceStatusRepository } from '@/modules/services/adapters/prisma-service-status';
/* eslint-enable no-restricted-imports */
// Despacho por ContentKind (GAP-8): CANDIDATE_PROFILE (USP-009), JOB (USP-020) e
// SERVICE (USP-029) usam suas tabelas reais; CV cai no fallback `_moderation_fixture`
// até sua USP. Cada tipo que aterrissa acrescenta seu adapter ao mapa.
container.register(
  CONTENT_STATUS_REPOSITORY_TOKEN,
  () =>
    new DispatchingContentStatusRepository(
      {
        [ContentKind.CANDIDATE_PROFILE]: new PrismaCandidateProfileStatusRepository(),
        [ContentKind.JOB]: new PrismaJobStatusRepository(),
        [ContentKind.SERVICE]: new PrismaServiceStatusRepository(),
      },
      new PrismaModerationContentRepository(),
    ),
);
container.register(MODERATION_NOTIFICATION_TOKEN, () => new OutboxModerationNotification());
container.register(CACHE_INVALIDATION_TOKEN, () => new NextCacheInvalidation());
container.register(COMPANY_VERIFY_HOOK_TOKEN, () => new PrismaCompanyVerifyHook());

// Extração de CV via IA (USP-040 / ADR-0012): porta `CVExtractor` → adapter
// Anthropic em produção; `FakeCVExtractor` só sob `env.CV_EXTRACTOR_FAKE`
// (guardado por `VERCEL_ENV` em `shared/env.ts` — nunca ativo em deploy real).
// eslint-disable-next-line no-restricted-imports
import { CV_EXTRACTOR_TOKEN } from '@/modules/cv-extraction/ports/cv-extractor.port';
// eslint-disable-next-line no-restricted-imports
import { AnthropicCVExtractor } from '@/modules/cv-extraction/adapters/anthropic-cv-extractor';
// eslint-disable-next-line no-restricted-imports
import { FakeCVExtractor } from '@/modules/cv-extraction/adapters/fake-cv-extractor';
container.register(CV_EXTRACTOR_TOKEN, () =>
  env.CV_EXTRACTOR_FAKE ? new FakeCVExtractor() : new AnthropicCVExtractor(),
);

// Cascata de artefatos da revogação de JOB_APPLICATION (USP-053 / CAND-7 /
// A-5): porta definida em `consents`, composta pelos participantes de tx dos
// módulos donos do dado (`jobs`, `persons`). Imports profundos aqui pelo mesmo
// motivo do `COMPANY_RESPONSIBILITY_TOKEN` acima — evitar dependência
// circular (`jobs`/`persons` já importam `consents` pelos barrels).
// eslint-disable-next-line no-restricted-imports
import { REVOCATION_EFFECTS_TOKEN } from '@/modules/consents/ports/revocation-effects';
// eslint-disable-next-line no-restricted-imports
import { endJobApplicationsForRevocation } from '@/modules/jobs/actions/end-job-applications-for-revocation';
// eslint-disable-next-line no-restricted-imports
import { hideCandidateProfileForRevocation } from '@/modules/persons/actions/hide-candidate-profile-for-revocation';
container.register(REVOCATION_EFFECTS_TOKEN, () => ({
  async applyJobApplicationCascade(tx, ctx) {
    const ended = await endJobApplicationsForRevocation(tx, ctx);
    // Mesmo shape de `ctx` do participante irmão acima (`RevocationEffectsContext`
    // === `HideCandidateProfileForRevocationContext`) — `actorPersonId`/`ip`/
    // `userAgent`/`justification` agora chegam ao `transitionContent()` por baixo
    // (remediação Fase 8: FSM audita a transição em vez do `updateMany` cru).
    const hidden = await hideCandidateProfileForRevocation(tx, ctx);
    return {
      applicationsEnded: ended.endedCount,
      endedApplicationIds: ended.endedApplicationIds,
      profileHidden: hidden.hidden,
    };
  },
}));
