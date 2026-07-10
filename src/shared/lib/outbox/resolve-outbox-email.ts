import { container } from '@/shared/container';
import type { EmailMessage } from '@/shared/lib/email/email-sender.port';
import { JOB_EXPIRY_EMAIL_RESOLVER_TOKEN, type JobExpiryEmailResolver } from './job-expiry-resolver.port';

/** Templates conhecidos da união `EmailMessage` — discrimina passthrough vs. malformado. */
const KNOWN_TEMPLATES: ReadonlySet<EmailMessage['template']> = new Set([
  'welcome',
  'password-reset',
  'credential-claim-welcome',
  'responsible-link-pending',
  'responsible-removed',
  'application-confirmation',
  'service-interest-notification',
  'referral-notification',
  'job-expiry',
]);

export interface ResolveOutboxEmailDeps {
  /** Injeta o hidratador de `JOB_EXPIRY_D3` nos testes; default resolve via `container`. */
  jobExpiryResolver?: JobExpiryEmailResolver;
}

/**
 * Resolve o payload cru de uma linha do Outbox (`topic='email'`) para um
 * `EmailMessage` pronto para envio (USP-044 / AC-044-D2/D3).
 *
 * - `template` presente e conhecido → passthrough direto (5 sítios já gravam o
 *   `EmailMessage` completo — `satisfies EmailMessage` na origem).
 * - `kind === 'JOB_EXPIRY_D3'` → delega ao hidratador de `jobs` (injetado ou via
 *   `container`); `null` do hidratador propaga (no-op gracioso, AC-044-D5).
 * - Payload malformado (nem `template` conhecido, nem `kind` conhecido) → lança;
 *   o chamador (`dispatchOutbox`) trata como falha da linha (attempts/lastError),
 *   nunca derruba o lote — vira poison ao atingir o cap (U44-MN-03).
 */
export async function resolveOutboxEmail(
  payload: unknown,
  deps: ResolveOutboxEmailDeps = {},
): Promise<EmailMessage | null> {
  if (!payload || typeof payload !== 'object') {
    throw new Error('outbox: payload malformado (não é objeto)');
  }
  const record = payload as Record<string, unknown>;

  if (typeof record.template === 'string' && KNOWN_TEMPLATES.has(record.template as EmailMessage['template'])) {
    // Passthrough — já validado (`satisfies EmailMessage`) no ponto de enqueue.
    return record as unknown as EmailMessage;
  }

  if (record.kind === 'JOB_EXPIRY_D3') {
    const jobId = record.jobId;
    if (typeof jobId !== 'string' || jobId.length === 0) {
      throw new Error('outbox: payload JOB_EXPIRY_D3 sem jobId válido');
    }
    const resolver = deps.jobExpiryResolver ?? container.resolve(JOB_EXPIRY_EMAIL_RESOLVER_TOKEN);
    return resolver(jobId);
  }

  throw new Error('outbox: payload malformado — nem template conhecido nem kind conhecido');
}
