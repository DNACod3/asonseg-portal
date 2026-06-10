/**
 * Catálogo fechado de eventos de auditoria (ADR-0023 / ADR-T-0004 — append-only).
 * Toda Server Action sensível registra um destes via `withAudit(...)`.
 *
 * Convenção: SNAKE_UPPER. Fonte canônica dos nomes: ADR-0004 (extensão Portal MVP)
 * e technical-design.md. Eventos novos exigem ADR ou nota em
 * `IDSD/architecture/runbooks/` — nunca usar string solta no código.
 *
 * O conjunto `JUSTIFICATION_REQUIRED_EVENTS` abaixo marca os eventos cujo campo
 * `justification` é obrigatório (revogação/rejeição/edição retroativa — ADR-0004).
 */
export const AuditEvent = {
  // ── Identity / Auth ──────────────────────────────────────────────────────
  AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILURE: 'AUTH_LOGIN_FAILURE',
  AUTH_SESSION_INVALIDATED: 'AUTH_SESSION_INVALIDATED',
  AUTH_PASSWORD_CHANGED_FIRST_ACCESS: 'AUTH_PASSWORD_CHANGED_FIRST_ACCESS',
  AUTH_PASSWORD_RESET_REQUESTED: 'AUTH_PASSWORD_RESET_REQUESTED',
  AUTH_PASSWORD_RESET_COMPLETED: 'AUTH_PASSWORD_RESET_COMPLETED',

  // ── Pessoa / Papéis (ADR-0011, ADR-0008) ─────────────────────────────────
  PERSON_CREATED_PUBLIC: 'PERSON_CREATED_PUBLIC',
  PERSON_CREATED_BY_AS: 'PERSON_CREATED_BY_AS',
  PERSON_CPF_EXCEPTION_GRANTED: 'PERSON_CPF_EXCEPTION_GRANTED',
  /** Tentativa indevida de usar a marca de exceção de CPF — fluxo público ou
   *  papel sem privilégio institucional (USP-002 / D-004). */
  PERSON_ASSISTED_EXCEPTION_DENIED: 'PERSON_ASSISTED_EXCEPTION_DENIED',
  PERSON_INACTIVATED: 'PERSON_INACTIVATED',
  /** Reativação de Pessoa inativada (USP-045 — fluxo inverso da USP-007). Grants zerados. */
  PERSON_REACTIVATED: 'PERSON_REACTIVATED',
  CREDENTIAL_CLAIM_REQUESTED: 'CREDENTIAL_CLAIM_REQUESTED',
  CREDENTIAL_CLAIM_VERIFIED: 'CREDENTIAL_CLAIM_VERIFIED',
  ROLE_GRANT_ACTIVATED: 'ROLE_GRANT_ACTIVATED',
  ROLE_GRANT_REVOKED: 'ROLE_GRANT_REVOKED',
  /** Ativação do papel candidato com criação/atualização do perfil em DRAFT (USP-009 / CAD-01). */
  CANDIDATE_ROLE_ACTIVATED: 'CANDIDATE_ROLE_ACTIVATED',
  DELEGATED_PERMISSION_GRANTED: 'DELEGATED_PERMISSION_GRANTED',
  DELEGATED_PERMISSION_REVOKED: 'DELEGATED_PERMISSION_REVOKED',

  // ── Empresa (ADR-0015) ────────────────────────────────────────────────────
  COMPANY_CREATED: 'COMPANY_CREATED',
  COMPANY_VERIFIED: 'COMPANY_VERIFIED',
  COMPANY_RESPONSIBLE_ADDED: 'COMPANY_RESPONSIBLE_ADDED',
  COMPANY_RESPONSIBLE_REMOVED: 'COMPANY_RESPONSIBLE_REMOVED',
  COMPANY_UPDATED: 'COMPANY_UPDATED',

  // ── Consentimentos LGPD (ADR-0009) ────────────────────────────────────────
  CONSENT_GRANTED: 'CONSENT_GRANTED',
  CONSENT_REVOKED: 'CONSENT_REVOKED',

  // ── Moderação (ADR-0011 — máquina de estados) ─────────────────────────────
  CONTENT_SUBMITTED_TO_MODERATION: 'CONTENT_SUBMITTED_TO_MODERATION',
  CONTENT_APPROVED: 'CONTENT_APPROVED',
  CONTENT_RETURNED_FOR_ADJUSTMENTS: 'CONTENT_RETURNED_FOR_ADJUSTMENTS',
  CONTENT_REJECTED: 'CONTENT_REJECTED',
  CONTENT_INACTIVATED_BY_COORDINATOR: 'CONTENT_INACTIVATED_BY_COORDINATOR',

  // ── Vagas ─────────────────────────────────────────────────────────────────
  JOB_PUBLISHED: 'JOB_PUBLISHED',
  JOB_EXPIRED: 'JOB_EXPIRED',
  JOB_PAUSED: 'JOB_PAUSED',
  JOB_ARCHIVED: 'JOB_ARCHIVED',
  JOB_EDITED_AFTER_APPROVAL: 'JOB_EDITED_AFTER_APPROVAL',

  // ── Candidaturas ──────────────────────────────────────────────────────────
  APPLICATION_CREATED: 'APPLICATION_CREATED',
  APPLICATION_CANCELLED: 'APPLICATION_CANCELLED',
  APPLICATION_VIEWED_BY_EMPLOYER: 'APPLICATION_VIEWED_BY_EMPLOYER',

  // ── Serviços ──────────────────────────────────────────────────────────────
  SERVICE_PUBLISHED: 'SERVICE_PUBLISHED',
  SERVICE_PAUSED: 'SERVICE_PAUSED',
  SERVICE_ARCHIVED: 'SERVICE_ARCHIVED',

  // ── Manifestações de interesse ────────────────────────────────────────────
  INTEREST_MANIFESTED: 'INTEREST_MANIFESTED',
  INTEREST_CANCELLED: 'INTEREST_CANCELLED',
  PROVIDER_CONTACT_REVEALED: 'PROVIDER_CONTACT_REVEALED',

  // ── Encaminhamentos ───────────────────────────────────────────────────────
  REFERRAL_CREATED: 'REFERRAL_CREATED',
  REFERRAL_RESULT_REGISTERED: 'REFERRAL_RESULT_REGISTERED',

  // ── Extração de CV (ADR-0012) ─────────────────────────────────────────────
  CV_EXTRACTION_REQUESTED: 'CV_EXTRACTION_REQUESTED',
  CV_EXTRACTION_COMPLETED: 'CV_EXTRACTION_COMPLETED',
  CV_EXTRACTION_FAILED: 'CV_EXTRACTION_FAILED',
  CV_USER_CONFIRMED_FIELDS: 'CV_USER_CONFIRMED_FIELDS',

  // ── Visibilidade / acesso a dado sensível (ADR-0010) ──────────────────────
  SENSITIVE_FIELD_VIEWED: 'SENSITIVE_FIELD_VIEWED',
  ACCESS_REPORT_ISSUED: 'ACCESS_REPORT_ISSUED',

  // ── Configuração global / taxonomia ───────────────────────────────────────
  CATEGORY_SUGGESTED: 'CATEGORY_SUGGESTED',
  CATEGORY_APPROVED: 'CATEGORY_APPROVED',
  REGION_ADDED: 'REGION_ADDED',
  JOB_AREA_ADDED: 'JOB_AREA_ADDED',

  // ── Retenção ──────────────────────────────────────────────────────────────
  AUDIT_LOG_PURGED: 'AUDIT_LOG_PURGED',
} as const;

export type AuditEventName = (typeof AuditEvent)[keyof typeof AuditEvent];

/**
 * Eventos cuja `justification` é obrigatória (ADR-0004 §extensão):
 * toda revogação, rejeição, inativação ou edição retroativa exige texto do operador.
 */
export const JUSTIFICATION_REQUIRED_EVENTS: ReadonlySet<AuditEventName> = new Set([
  AuditEvent.CONSENT_REVOKED,
  AuditEvent.ROLE_GRANT_REVOKED,
  AuditEvent.DELEGATED_PERMISSION_REVOKED,
  AuditEvent.PERSON_INACTIVATED,
  AuditEvent.PERSON_REACTIVATED,
  AuditEvent.CONTENT_RETURNED_FOR_ADJUSTMENTS,
  AuditEvent.CONTENT_REJECTED,
  AuditEvent.CONTENT_INACTIVATED_BY_COORDINATOR,
  AuditEvent.JOB_EDITED_AFTER_APPROVAL,
  AuditEvent.COMPANY_RESPONSIBLE_REMOVED,
]);

/** `true` se o evento exige `justification` não-vazia. */
export function requiresJustification(event: AuditEventName): boolean {
  return JUSTIFICATION_REQUIRED_EVENTS.has(event);
}
