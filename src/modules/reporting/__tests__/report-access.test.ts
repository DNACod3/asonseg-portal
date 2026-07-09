import { describe, it, expect } from 'vitest';
import {
  canViewOperationalReports,
  canViewSocialReports,
  canViewModerationQueueReport,
  OPERATIONAL_REPORT_ROLES,
  SOCIAL_REPORT_ROLES,
} from '../domain/report-access';
import type { CurrentPerson } from '@/modules/identity';
import type { DelegatedGrant } from '@/modules/identity';

/**
 * Unit tests dos guards de papel de USP-042 (T1 — E-001, REL42-MN-02/03/05).
 * Todos os ramos: coordenador/BOARD → ops true; AS/BOARD → social true;
 * voluntário/candidato/[]/anônimo → false; R5 via `MODERATE_*` + delegação.
 */

function person(roles: string[]): CurrentPerson {
  return {
    id: 'p-1',
    supabaseUserId: 'u-1',
    fullName: 'Pessoa Teste',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles,
    phone: null,
    fullAddress: null,
  };
}

describe('canViewOperationalReports (R1..R4)', () => {
  it('COORDINATOR → true', () => {
    expect(canViewOperationalReports(['COORDINATOR'])).toBe(true);
  });
  it('BOARD → true', () => {
    expect(canViewOperationalReports(['BOARD'])).toBe(true);
  });
  it('SOCIAL_ASSISTANT sozinho → false (não é ops)', () => {
    expect(canViewOperationalReports(['SOCIAL_ASSISTANT'])).toBe(false);
  });
  it('VOLUNTEER/CANDIDATE → false', () => {
    expect(canViewOperationalReports(['VOLUNTEER'])).toBe(false);
    expect(canViewOperationalReports(['CANDIDATE'])).toBe(false);
  });
  it('[] (sem papel) → false', () => {
    expect(canViewOperationalReports([])).toBe(false);
  });
  it('OPERATIONAL_REPORT_ROLES é exatamente {COORDINATOR,BOARD}', () => {
    expect([...OPERATIONAL_REPORT_ROLES].sort()).toEqual(['BOARD', 'COORDINATOR']);
  });
});

describe('canViewSocialReports (R6)', () => {
  it('SOCIAL_ASSISTANT → true', () => {
    expect(canViewSocialReports(['SOCIAL_ASSISTANT'])).toBe(true);
  });
  it('BOARD → true', () => {
    expect(canViewSocialReports(['BOARD'])).toBe(true);
  });
  it('COORDINATOR sozinho → false (REL42-MN-05: coordenador não é social)', () => {
    expect(canViewSocialReports(['COORDINATOR'])).toBe(false);
  });
  it('VOLUNTEER/anônimo ([]) → false', () => {
    expect(canViewSocialReports(['VOLUNTEER'])).toBe(false);
    expect(canViewSocialReports([])).toBe(false);
  });
  it('SOCIAL_REPORT_ROLES é exatamente {SOCIAL_ASSISTANT,BOARD}', () => {
    expect([...SOCIAL_REPORT_ROLES].sort()).toEqual(['BOARD', 'SOCIAL_ASSISTANT']);
  });
});

describe('canViewModerationQueueReport (R5 — REL42-MN-02)', () => {
  it('null (anônimo/sem sessão) → false', () => {
    expect(canViewModerationQueueReport(null, [])).toBe(false);
  });

  it('BOARD sem nenhum grant/permissão de catálogo → true (diretoria)', () => {
    expect(canViewModerationQueueReport(person(['BOARD']), [])).toBe(true);
  });

  it('COORDINATOR (permissão inerente MODERATE_*) → true', () => {
    expect(canViewModerationQueueReport(person(['COORDINATOR']), [])).toBe(true);
  });

  it('negativo: VOLUNTEER sem MODERATE_* delegado → false (não vaza rascunho)', () => {
    expect(canViewModerationQueueReport(person(['VOLUNTEER']), [])).toBe(false);
  });

  it('VOLUNTEER com MODERATE_JOB delegado (não revogado) → true', () => {
    const grants: DelegatedGrant[] = [
      { permission: 'MODERATE_JOB', scopeArea: null, revokedAt: null },
    ];
    expect(canViewModerationQueueReport(person(['VOLUNTEER']), grants)).toBe(true);
  });

  it('VOLUNTEER com MODERATE_CV delegado → true', () => {
    const grants: DelegatedGrant[] = [
      { permission: 'MODERATE_CV', scopeArea: null, revokedAt: null },
    ];
    expect(canViewModerationQueueReport(person(['VOLUNTEER']), grants)).toBe(true);
  });

  it('VOLUNTEER com MODERATE_SERVICE delegado → true', () => {
    const grants: DelegatedGrant[] = [
      { permission: 'MODERATE_SERVICE', scopeArea: null, revokedAt: null },
    ];
    expect(canViewModerationQueueReport(person(['VOLUNTEER']), grants)).toBe(true);
  });

  it('VOLUNTEER com MODERATE_JOB REVOGADO → false', () => {
    const grants: DelegatedGrant[] = [
      { permission: 'MODERATE_JOB', scopeArea: null, revokedAt: new Date('2026-01-01') },
    ];
    expect(canViewModerationQueueReport(person(['VOLUNTEER']), grants)).toBe(false);
  });

  it('VOLUNTEER com grant de outra permissão (REFER_PERSON_TO_JOB) → false', () => {
    const grants: DelegatedGrant[] = [
      { permission: 'REFER_PERSON_TO_JOB', scopeArea: null, revokedAt: null },
    ];
    expect(canViewModerationQueueReport(person(['VOLUNTEER']), grants)).toBe(false);
  });
});
