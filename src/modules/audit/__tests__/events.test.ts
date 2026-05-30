import { describe, it, expect } from 'vitest';
import { AuditEvent } from '@/modules/audit';

describe('audit/events', () => {
  it('expõe o catálogo de eventos AUTH_* da USP-004', () => {
    expect(AuditEvent.AUTH_LOGIN_SUCCESS).toBe('AUTH_LOGIN_SUCCESS');
    expect(AuditEvent.AUTH_LOGIN_FAILURE).toBe('AUTH_LOGIN_FAILURE');
    expect(AuditEvent.AUTH_SESSION_INVALIDATED).toBe('AUTH_SESSION_INVALIDATED');
    expect(AuditEvent.AUTH_PASSWORD_CHANGED_FIRST_ACCESS).toBe(
      'AUTH_PASSWORD_CHANGED_FIRST_ACCESS',
    );
  });

  it('catálogo é objeto literal `as const` (sem chaves dinâmicas)', () => {
    const keys = Object.keys(AuditEvent).sort();
    expect(keys).toEqual(
      [
        'AUTH_LOGIN_SUCCESS',
        'AUTH_LOGIN_FAILURE',
        'AUTH_SESSION_INVALIDATED',
        'AUTH_PASSWORD_CHANGED_FIRST_ACCESS',
      ].sort(),
    );
  });
});
