import { env } from '@/shared/env';
import { childLogger } from '@/shared/lib/logger';
import type {
  EmailMessage,
  EmailSender,
  EmailSendResult,
  RenderedEmail,
} from './email-sender.port';
import { renderWelcomeEmail } from './templates/welcome';
import { renderPasswordResetEmail } from './templates/password-reset';
import { renderCredentialClaimWelcomeEmail } from './templates/credential-claim-welcome';
import { renderResponsibleLinkPendingEmail } from './templates/responsible-link-pending';
import { renderResponsibleRemovedEmail } from './templates/responsible-removed';
import { renderApplicationConfirmationEmail } from './templates/application-confirmation';
import { renderServiceInterestNotificationEmail } from './templates/service-interest-notification';
import { renderReferralNotificationEmail } from './templates/referral-notification';
import { renderJobExpiryEmail } from './templates/job-expiry';
import { renderModerationApprovedEmail } from './templates/moderation-approved';
import { renderModerationReturnedEmail } from './templates/moderation-returned';
import { renderModerationRejectedEmail } from './templates/moderation-rejected';

/**
 * Adapter `EmailSender` **dev-only** (USP-060 / AUTH-9 / HYG-04) que entrega ao
 * Mailpit local via SMTP — dá visibilidade VISUAL aos e-mails transacionais em
 * desenvolvimento (achado AUTH-9/REL-4: hoje nenhum AC de e-mail é verificável
 * visualmente). Selecionado pelo container apenas quando `EMAIL_DEV_SMTP=true`
 * (T11) — flag fenced por `VERCEL_ENV` no `env.ts` (HYG-MN-04), nunca resolvido
 * num deploy real.
 *
 * `nodemailer` é importado **dinamicamente** dentro de {@link send} — mantém a
 * devDependency fora do grafo estático de import, para que o build de produção
 * (que nunca chama este adapter) não a trace no bundle.
 */

/** Subconjunto estrutural do transporte do `nodemailer` consumido aqui — permite
 *  injetar um fake no teste sem SMTP real, mesmo padrão de `ResendClient`. */
export interface DevSmtpTransport {
  sendMail(payload: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<{ messageId?: string }>;
}

/** Escolhe o renderer do template (exaustivo sobre a união `EmailMessage`) —
 *  espelha o `render()` privado de `resend-email-sender.ts`. */
function render(message: EmailMessage): RenderedEmail {
  switch (message.template) {
    case 'welcome':
      return renderWelcomeEmail(message.data);
    case 'password-reset':
      return renderPasswordResetEmail(message.data);
    case 'credential-claim-welcome':
      return renderCredentialClaimWelcomeEmail(message.data);
    case 'responsible-link-pending':
      return renderResponsibleLinkPendingEmail(message.data);
    case 'responsible-removed':
      return renderResponsibleRemovedEmail(message.data);
    case 'application-confirmation':
      return renderApplicationConfirmationEmail(message.data);
    case 'service-interest-notification':
      return renderServiceInterestNotificationEmail(message.data);
    case 'referral-notification':
      return renderReferralNotificationEmail(message.data);
    case 'job-expiry':
      return renderJobExpiryEmail(message.data);
    case 'moderation-approved':
      return renderModerationApprovedEmail(message.data);
    case 'moderation-returned':
      return renderModerationReturnedEmail(message.data);
    case 'moderation-rejected':
      return renderModerationRejectedEmail(message.data);
  }
}

export class DevSmtpEmailSender implements EmailSender {
  private transportPromise: Promise<DevSmtpTransport> | null = null;

  /** Em teste, injeta um transporte fake pelo construtor (sem SMTP real). Em
   *  dev real, o transporte é criado lazily em `send()` (import dinâmico). */
  constructor(private readonly injectedTransport?: DevSmtpTransport) {}

  private async getTransport(): Promise<DevSmtpTransport> {
    if (this.injectedTransport) return this.injectedTransport;
    if (!this.transportPromise) {
      this.transportPromise = (async () => {
        const { createTransport } = await import('nodemailer');
        return createTransport({
          host: env.EMAIL_DEV_SMTP_HOST,
          port: env.EMAIL_DEV_SMTP_PORT,
          secure: false,
        }) as unknown as DevSmtpTransport;
      })();
    }
    return this.transportPromise;
  }

  /**
   * Nunca lança (contrato da porta `EmailSender` — USP-044): falha de SMTP
   * (ex.: Mailpit fora do ar) vira `{ ok: false }`. Loga só metadados
   * (template no `childLogger` + status) — **nunca** o destinatário nem o
   * corpo renderizado (HYG-MN-04/U44-MN-04), mesmo padrão de
   * `ResendEmailSender`/`dispatch-outbox.ts`.
   */
  async send(message: EmailMessage): Promise<EmailSendResult> {
    const log = childLogger({ module: 'email', adapter: 'dev-smtp', template: message.template });
    const { subject, html, text } = render(message);

    try {
      const transport = await this.getTransport();
      const info = await transport.sendMail({
        from: env.EMAIL_FROM,
        to: message.to,
        subject,
        html,
        text,
      });
      // Metadados apenas (template já está no childLogger acima) — nunca o
      // destinatário nem o corpo renderizado (HYG-MN-04/U44-MN-04), mesmo
      // padrão de `ResendEmailSender`/`dispatch-outbox.ts` (nunca logam `to`).
      log.info({ status: 'sent' }, 'email:dev_smtp_sent');
      return { ok: true, id: info.messageId };
    } catch (err) {
      log.error(
        { status: 'failed', err: err instanceof Error ? err.message : 'erro desconhecido' },
        'email:dev_smtp_failed',
      );
      return { ok: false };
    }
  }
}
