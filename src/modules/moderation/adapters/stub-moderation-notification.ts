import { childLogger } from '@/shared/lib/logger';
import type {
  ModerationDecisionNotice,
  ModerationNotificationPort,
} from '../ports/moderation-notification.port';

/**
 * Adapter stub do {@link ModerationNotificationPort} (GAP-3 / USP-044).
 *
 * Não envia e-mail — apenas registra a intenção no log estruturado. O canal real
 * (Resend + templates) entra na USP-044, trocando este binding no container.
 * Não inclui PII (corpo/e-mail do autor) — só ids e a transição.
 */
export class StubModerationNotification implements ModerationNotificationPort {
  private readonly log = childLogger({ module: 'moderation', adapter: 'notification-stub' });

  async sendModerationDecision(notice: ModerationDecisionNotice): Promise<void> {
    this.log.info(
      {
        contentKind: notice.contentKind,
        contentId: notice.contentId,
        from: notice.from,
        to: notice.to,
        actorPersonId: notice.actorPersonId,
        hasJustification: Boolean(notice.justification),
      },
      'moderation:notification:stub (e-mail real chega na USP-044)',
    );
  }
}
