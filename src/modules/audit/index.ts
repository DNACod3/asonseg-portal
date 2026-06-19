// Barrel do módulo `audit` — auditoria append-only de eventos sensíveis
// (ADR-0023 / ADR-T-0004). Imports passam exclusivamente por este arquivo.

export {
  AuditEvent,
  type AuditEventName,
  JUSTIFICATION_REQUIRED_EVENTS,
  requiresJustification,
} from './events';
export {
  withAudit,
  recordAuditEvent,
  type AuditContext,
  type AuditRecorder,
  type AuditFn,
  type AuditTx,
} from './withAudit';
export { purgeExpiredAuditLogs, AUDIT_RETENTION_DAYS } from './retention';
