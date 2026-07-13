import type { AuditTx } from '@/modules/audit';
import { createToken } from '@/shared/container';
import type { ContentKind, ContentStatus } from '../domain/content-status';

/** Dados de uma decisão de moderação para notificar o autor (e-mail — USP-044/USP-057). */
export interface ModerationDecisionNotice {
  contentKind: ContentKind;
  contentId: string;
  from: ContentStatus;
  to: ContentStatus;
  /** Motivo enviado ao autor em devolução/rejeição (opcional na aprovação). */
  justification?: string | null;
  actorPersonId: string;
}

/**
 * Notificação ao autor sobre a decisão de moderação (E-002/E-003/E-004).
 *
 * O adapter real (USP-057) **enfileira** o e-mail no `Outbox` via `tx` — na
 * **mesma transação** da decisão (AD-007/P-007), espelhando
 * `CompanyVerifyHookPort.onContentActivated(tx, …)`. É um side effect
 * **soft-fail** — falha não aborta a transição (ADR-0011 R2).
 */
export interface ModerationNotificationPort {
  sendModerationDecision(tx: AuditTx, notice: ModerationDecisionNotice): Promise<void>;
}

export const MODERATION_NOTIFICATION_TOKEN =
  createToken<ModerationNotificationPort>('ModerationNotificationPort');
