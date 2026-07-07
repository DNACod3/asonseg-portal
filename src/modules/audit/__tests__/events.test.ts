import { describe, it, expect } from 'vitest';
import { AuditEvent, requiresJustification, JUSTIFICATION_REQUIRED_EVENTS } from '@/modules/audit';

describe('audit/events', () => {
  it('mantém os eventos AUTH_* da USP-004', () => {
    expect(AuditEvent.AUTH_LOGIN_SUCCESS).toBe('AUTH_LOGIN_SUCCESS');
    expect(AuditEvent.AUTH_LOGIN_FAILURE).toBe('AUTH_LOGIN_FAILURE');
    expect(AuditEvent.AUTH_SESSION_INVALIDATED).toBe('AUTH_SESSION_INVALIDATED');
    expect(AuditEvent.AUTH_PASSWORD_CHANGED_FIRST_ACCESS).toBe(
      'AUTH_PASSWORD_CHANGED_FIRST_ACCESS',
    );
  });

  it('cobre o catálogo transversal do MVP (ADR-0004)', () => {
    // Amostra representativa das categorias da extensão Portal MVP.
    for (const name of [
      'PERSON_CREATED_PUBLIC',
      'CONSENT_GRANTED',
      'CONSENT_REVOKED',
      'ROLE_GRANT_ACTIVATED',
      'DELEGATED_PERMISSION_GRANTED',
      'CONTENT_REJECTED',
      'CV_EXTRACTION_COMPLETED',
      'SENSITIVE_FIELD_VIEWED',
      'ACCESS_REPORT_ISSUED',
      'AUDIT_LOG_PURGED',
    ] as const) {
      expect(AuditEvent[name]).toBe(name);
    }
  });

  it('cada chave do catálogo mapeia para uma string idêntica à chave', () => {
    for (const [key, value] of Object.entries(AuditEvent)) {
      expect(value).toBe(key);
    }
  });

  it('não há valores duplicados no catálogo', () => {
    const values = Object.values(AuditEvent);
    expect(new Set(values).size).toBe(values.length);
  });

  it('marca eventos de revogação/rejeição como exigindo justificativa', () => {
    expect(requiresJustification(AuditEvent.CONSENT_REVOKED)).toBe(true);
    expect(requiresJustification(AuditEvent.CONTENT_REJECTED)).toBe(true);
    expect(requiresJustification(AuditEvent.PERSON_INACTIVATED)).toBe(true);
    // Eventos de criação/leitura não exigem.
    expect(requiresJustification(AuditEvent.CONSENT_GRANTED)).toBe(false);
    expect(requiresJustification(AuditEvent.AUTH_LOGIN_SUCCESS)).toBe(false);
  });

  it('todos os eventos que exigem justificativa pertencem ao catálogo', () => {
    const known = new Set<string>(Object.values(AuditEvent));
    for (const event of JUSTIFICATION_REQUIRED_EVENTS) {
      expect(known.has(event)).toBe(true);
    }
  });

  it('inclui o evento de tentativa indevida de exceção (USP-002 / D-004)', () => {
    expect(AuditEvent.PERSON_ASSISTED_EXCEPTION_DENIED).toBe('PERSON_ASSISTED_EXCEPTION_DENIED');
    // Evento de tentativa/negação — não exige justificativa.
    expect(requiresJustification(AuditEvent.PERSON_ASSISTED_EXCEPTION_DENIED)).toBe(false);
  });

  it('inclui CATEGORY_SUGGESTION_REJECTED (USP-019) e NÃO exige justificativa (motivo opcional)', () => {
    expect(AuditEvent.CATEGORY_SUGGESTION_REJECTED).toBe('CATEGORY_SUGGESTION_REJECTED');
    expect(requiresJustification(AuditEvent.CATEGORY_SUGGESTION_REJECTED)).toBe(false);
  });
});
