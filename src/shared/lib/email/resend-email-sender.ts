import { Resend } from 'resend';
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

/**
 * Subconjunto estrutural do client Resend que o adapter consome. Mantê-lo
 * explícito permite injetar um fake no teste sem depender da rede nem do SDK.
 */
export interface ResendClient {
  emails: {
    send(payload: {
      from: string;
      to: string | string[];
      subject: string;
      html: string;
      text: string;
    }): Promise<{ data: { id: string } | null; error: { message: string } | null }>;
  };
}

/** Escolhe o renderer do template (exaustivo sobre a união `EmailMessage`). */
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
  }
}

/**
 * Adapter Resend da porta {@link EmailSender} (IDN-12). Renderiza o template e
 * delega o envio ao Resend. Nunca lança: erro do provedor é logado e devolvido
 * como `{ ok: false }` — em USP-005 o caller não revela isso ao usuário.
 */
export class ResendEmailSender implements EmailSender {
  private readonly client: ResendClient;

  constructor(client?: ResendClient) {
    // Em produção instanciamos o SDK; em teste injetamos um fake pelo construtor.
    this.client = client ?? (new Resend(env.RESEND_API_KEY) as unknown as ResendClient);
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const log = childLogger({ module: 'email', template: message.template });
    const { subject, html, text } = render(message);

    const { data, error } = await this.client.emails.send({
      from: env.EMAIL_FROM,
      to: message.to,
      subject,
      html,
      text,
    });

    if (error || !data) {
      log.error({ err: error?.message ?? 'sem dados' }, 'email:send_failed');
      return { ok: false };
    }

    return { ok: true, id: data.id };
  }
}
