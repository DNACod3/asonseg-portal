import type { AuditTx } from '@/modules/audit';
import { childLogger } from '@/shared/lib/logger';
import type {
  ModerationDecisionNotice,
  ModerationNotificationPort,
} from '../ports/moderation-notification.port';

/**
 * Adapter stub do {@link ModerationNotificationPort} (GAP-3). Ainda usado pelos
 * testes de unit dos demais adapters (`adapters.test.ts`) — o binding real do
 * container é {@link OutboxModerationNotification} (USP-057).
 *
 * Não envia/enfileira e-mail — apenas registra a intenção no log estruturado.
 * Não inclui PII (corpo/e-mail do autor) — só ids e a transição. `tx` recebido
 * e ignorado (mantém a assinatura do port).
 */
export class StubModerationNotification implements ModerationNotificationPort {
  private readonly log = childLogger({ module: 'moderation', adapter: 'notification-stub' });

  async sendModerationDecision(_tx: AuditTx, notice: ModerationDecisionNotice): Promise<void> {
    this.log.info(
      {
        contentKind: notice.contentKind,
        contentId: notice.contentId,
        from: notice.from,
        to: notice.to,
        actorPersonId: notice.actorPersonId,
        hasJustification: Boolean(notice.justification),
      },
      'moderation:notification:stub (usado só em teste — binding real = OutboxModerationNotification/USP-057)',
    );
  }
}
