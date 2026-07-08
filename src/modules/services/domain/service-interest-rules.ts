/**
 * Regras puras (sem IO) do agregado `ServiceInterest` (USP-033/034 — AD-020).
 * Espelham `jobs/domain/application-rules.ts`, adaptadas à semântica de
 * Serviço (sem `validUntil`/Empresa verificada — ver `getActiveServiceDetail`).
 */

/** Shape mínimo de um serviço necessário para decidir se aceita manifestação. */
export interface ServiceInterestServiceInput {
  status: string;
  authorInactivatedAt: Date | null;
}

/**
 * WHEN o serviço está `ACTIVE` e o prestador (autor) está ativo THEN elegível a
 * receber manifestação de interesse (SVC033-MN-05). Mesma semântica on-read de
 * `getActiveServiceDetail` (`status='ACTIVE' AND author.inactivatedAt IS NULL`).
 */
export function isServiceOpenForInterest(service: ServiceInterestServiceInput): boolean {
  return service.status === 'ACTIVE' && service.authorInactivatedAt == null;
}

/** Resultado discriminado da elegibilidade de cancelamento (USP-034). */
export type CancelInterestCheck = { ok: true } | { ok: false; reason: 'ALREADY_CANCELLED' };

/**
 * WHEN a manifestação já está cancelada (`cancelledAt != null`) THEN a
 * decisão de negócio é reportar isso (`ALREADY_CANCELLED`) — o CHAMADOR
 * (`cancelInterest`) trata esse caso de forma **idempotente** (AC-034-3),
 * divergindo intencionalmente de `canCancelApplication` (que gera
 * `PRECONDITION_FAILED` em `jobs`). A checagem de dono/existência é
 * responsabilidade da query escopada em `cancelInterest`; esta regra pura só
 * decide sobre o estado de uma linha já pertencente ao cliente.
 */
export function canCancelInterest(interest: { cancelledAt: Date | null }): CancelInterestCheck {
  return interest.cancelledAt == null ? { ok: true } : { ok: false, reason: 'ALREADY_CANCELLED' };
}
