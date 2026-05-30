/**
 * Catálogo fechado de eventos de auditoria (ADR-0023 — append-only).
 * Toda Server Action sensível registra um destes via `withAudit(...)`.
 *
 * Convenção: `<MODULO>_<ACAO>_<RESULTADO>` em SNAKE_UPPER.
 * Eventos novos exigem ADR ou nota em `IDSD/architecture/runbooks/`.
 */
export const AuditEvent = {
  // Identity / Auth (USP-004)
  AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILURE: 'AUTH_LOGIN_FAILURE',
  AUTH_SESSION_INVALIDATED: 'AUTH_SESSION_INVALIDATED',
  AUTH_PASSWORD_CHANGED_FIRST_ACCESS: 'AUTH_PASSWORD_CHANGED_FIRST_ACCESS',
} as const;

export type AuditEventName = (typeof AuditEvent)[keyof typeof AuditEvent];

/**
 * Payload mínimo de um evento de auditoria.
 * Cada evento pode estender com campos próprios via Record.
 */
export interface AuditPayload {
  /** ID da Pessoa que originou o evento (opcional em login com e-mail desconhecido). */
  personId?: string | null;
  /** IP de origem (x-forwarded-for ou request.ip). */
  ip?: string | null;
  /** User-Agent. */
  userAgent?: string | null;
  /** Detalhes extras específicos do evento. Evitar PII; usar `logger`'s redaction se houver. */
  details?: Record<string, unknown>;
}
