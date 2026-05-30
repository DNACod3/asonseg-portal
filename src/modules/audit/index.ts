// Barrel do módulo `audit` — auditoria append-only de eventos sensíveis (ADR-0023).
// Imports passam exclusivamente por este arquivo.

export { AuditEvent, type AuditEventName, type AuditPayload } from './events';
export { withAudit } from './withAudit';
