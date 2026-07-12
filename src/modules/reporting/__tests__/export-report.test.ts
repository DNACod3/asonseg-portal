import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit tests de `exportReport` (T11) com dependências mockadas — espelha o
 * padrão de `access-report.test.ts` (estado hoisted + `vi.mock` +
 * `await import(...)` após os mocks). Cobre a sequência canônica e os
 * must-nots que não dependem de Postgres real: MN-03 (não autorizado),
 * MN-06 (PII sem ciência) e MN-07 (falha do audit ⇒ rollback). Os guards de
 * papel (`domain/report-access`) rodam DE VERDADE (são puros) via
 * `vi.importActual` — só a leitura/IO é mockada. Happy CSV/PDF contra
 * Postgres real vive em `export-report.int.test.ts`.
 */

const auditState = vi.hoisted(() => ({
  events: [] as string[],
  last: null as Record<string, unknown> | null,
  shouldFail: false,
}));
const identityState = vi.hoisted(() => ({
  current: null as { id: string; fullName: string; roles: string[] } | null,
}));
const moderationGrantsState = vi.hoisted(() => ({ findManyGrants: vi.fn() }));
const queryState = vi.hoisted(() => ({
  reportJobs: vi.fn(),
  reportApplications: vi.fn(),
  reportServices: vi.fn(),
  reportReferrals: vi.fn(),
  reportModerationQueue: vi.fn(),
  viewSocialReport: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest' }),
}));

vi.mock('@/modules/audit', () => ({
  AuditEvent: { REPORT_EXPORTED: 'REPORT_EXPORTED' },
  withAudit: async (
    event: string,
    fn: (tx: unknown, audit: Record<string, unknown>) => Promise<unknown>,
  ) => {
    if (auditState.shouldFail) throw new Error('audit write failed (simulado — MN-07)');
    auditState.events.push(event);
    const recorder: Record<string, unknown> = {};
    const result = await fn({}, recorder);
    auditState.last = recorder;
    return result;
  },
}));

vi.mock('@/modules/identity', async () => {
  const actual = await vi.importActual<typeof import('@/modules/identity')>('@/modules/identity');
  return { ...actual, getCurrentPerson: async () => identityState.current };
});

vi.mock('../queries/moderation-grants', () => ({
  getModerationGrants: (...args: unknown[]) => moderationGrantsState.findManyGrants(...args),
}));

vi.mock('../queries/report-jobs', () => ({
  reportJobs: (...a: unknown[]) => queryState.reportJobs(...a),
}));
vi.mock('../queries/report-applications', () => ({
  reportApplications: (...a: unknown[]) => queryState.reportApplications(...a),
}));
vi.mock('../queries/report-services', () => ({
  reportServices: (...a: unknown[]) => queryState.reportServices(...a),
}));
vi.mock('../queries/report-referrals', () => ({
  reportReferrals: (...a: unknown[]) => queryState.reportReferrals(...a),
}));
vi.mock('../queries/report-moderation-queue', () => ({
  reportModerationQueue: (...a: unknown[]) => queryState.reportModerationQueue(...a),
}));
vi.mock('../views/social-report.view', () => ({
  viewSocialReport: (...a: unknown[]) => queryState.viewSocialReport(...a),
}));

vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: async () => Buffer.from('%PDF-FAKE'),
  StyleSheet: { create: (styles: unknown) => styles },
  Document: 'Document',
  Page: 'Page',
  Text: 'Text',
  View: 'View',
}));

const { exportReport } = await import('../actions/export-report');

beforeEach(() => {
  vi.clearAllMocks();
  auditState.events = [];
  auditState.last = null;
  auditState.shouldFail = false;
  identityState.current = null;
  moderationGrantsState.findManyGrants.mockReset().mockResolvedValue([]);
  queryState.reportJobs.mockReset();
  queryState.reportApplications.mockReset();
  queryState.reportServices.mockReset();
  queryState.reportReferrals.mockReset();
  queryState.reportModerationQueue.mockReset();
  queryState.viewSocialReport.mockReset();
});

describe('exportReport', () => {
  it('VALIDATION: reportType inválido → erro de validação, sem checar sessão', async () => {
    const result = await exportReport({
      // @ts-expect-error — reportType inválido de propósito
      reportType: 'bogus',
      filters: {},
      format: 'CSV',
      acknowledgePII: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('UNAUTHENTICATED: sem sessão', async () => {
    const result = await exportReport({ reportType: 'jobs', filters: {}, format: 'CSV', acknowledgePII: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHENTICATED');
    expect(auditState.events).not.toContain('REPORT_EXPORTED');
  });

  it('REL42-MN-03 (negativo): VOLUNTEER sem guard → FORBIDDEN, sem query, sem audit, sem arquivo', async () => {
    identityState.current = { id: 'p-vol', fullName: 'Voluntário', roles: ['VOLUNTEER'] };

    const result = await exportReport({ reportType: 'jobs', filters: {}, format: 'CSV', acknowledgePII: false });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
    expect(queryState.reportJobs).not.toHaveBeenCalled();
    expect(auditState.events).not.toContain('REPORT_EXPORTED');
    if (!result.ok) expect('data' in result).toBe(false); // sem payload/arquivo
  });

  it('happy CSV: COORDINATOR exporta relatório de vagas (sem PII) — REPORT_EXPORTED auditado com containsPII=false', async () => {
    identityState.current = { id: 'p-coord', fullName: 'Ana Coordenadora', roles: ['COORDINATOR'] };
    queryState.reportJobs.mockResolvedValue([{ status: 'ACTIVE', count: 3 }]);

    const result = await exportReport({
      reportType: 'jobs',
      filters: { from: '2026-01-01', to: '2026-01-31' },
      format: 'CSV',
      acknowledgePII: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.format).toBe('CSV');
      expect(result.data.mimeType).toContain('text/csv');
      expect(result.data.content).toContain('Status;Quantidade');
      // USP-058/REL-3 (G2): status em PT-BR também no export (buildReportRows traduz antes do CSV).
      expect(result.data.content).toContain('Ativo;3');
    }
    expect(auditState.events).toContain('REPORT_EXPORTED');
    expect(auditState.last).toMatchObject({
      entityType: 'report',
      after: { reportType: 'jobs', format: 'CSV', containsPII: false, rowCount: 1 },
    });
  });

  it('happy PDF: COORDINATOR exporta em PDF — mimeType application/pdf, conteúdo é base64 do buffer renderizado', async () => {
    identityState.current = { id: 'p-coord', fullName: 'Ana Coordenadora', roles: ['COORDINATOR'] };
    queryState.reportJobs.mockResolvedValue([{ status: 'ACTIVE', count: 1 }]);

    const result = await exportReport({ reportType: 'jobs', filters: {}, format: 'PDF', acknowledgePII: false });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.format).toBe('PDF');
      expect(result.data.mimeType).toBe('application/pdf');
      expect(Buffer.from(result.data.content, 'base64').toString('utf-8')).toBe('%PDF-FAKE');
    }
  });

  it('REL42-MN-06 (negativo): SOCIAL_ASSISTANT exporta relatório social SEM acknowledgePII → VALIDATION, sem query, sem audit, sem arquivo', async () => {
    identityState.current = { id: 'p-as', fullName: 'AS', roles: ['SOCIAL_ASSISTANT'] };

    const result = await exportReport({ reportType: 'social', filters: {}, format: 'CSV', acknowledgePII: false });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
    expect(queryState.viewSocialReport).not.toHaveBeenCalled();
    expect(auditState.events).not.toContain('REPORT_EXPORTED');
  });

  it('REL42-MN-01 (negativo): SOCIAL_ASSISTANT com acknowledgePII=true → CSV com watermark na 1ª linha', async () => {
    identityState.current = { id: 'p-as', fullName: 'AS da Silva', roles: ['SOCIAL_ASSISTANT'] };
    queryState.viewSocialReport.mockResolvedValue({
      scope: 'full',
      regions: [{ regionId: 'r1', regionName: 'Centro', total: 2 }],
      sensitive: [
        {
          regionId: 'r1',
          regionName: 'Centro',
          byIncomeBracket: { UP_TO_1_MW: 2 },
          byHousingSituation: {},
          withSocialBenefit: 1,
          withFamilyCompositionDeclared: 0,
        },
      ],
    });

    const result = await exportReport({ reportType: 'social', filters: {}, format: 'CSV', acknowledgePII: true });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const firstLine = result.data.content.split('\r\n')[0];
      expect(firstLine).toContain('Dados pessoais — uso restrito conforme LGPD');
      expect(firstLine).toContain('AS da Silva');
    }
    expect(auditState.last).toMatchObject({ after: { reportType: 'social', containsPII: true } });
  });

  it('social stripped (COORDINATOR): containsPII=false — exporta SEM exigir acknowledgePII', async () => {
    identityState.current = { id: 'p-coord', fullName: 'Ana Coordenadora', roles: ['COORDINATOR'] };
    queryState.viewSocialReport.mockResolvedValue({
      scope: 'stripped',
      regions: [{ regionId: 'r1', regionName: 'Centro', total: 5 }],
      sensitive: null,
    });

    const result = await exportReport({ reportType: 'social', filters: {}, format: 'CSV', acknowledgePII: false });

    expect(result.ok).toBe(true);
    expect(auditState.last).toMatchObject({ after: { containsPII: false } });
  });

  it('REL42-MN-02: fila de moderação — voluntário sem MODERATE_* → FORBIDDEN', async () => {
    identityState.current = { id: 'p-vol', fullName: 'Voluntário', roles: ['VOLUNTEER'] };
    moderationGrantsState.findManyGrants.mockResolvedValue([]);

    const result = await exportReport({
      reportType: 'moderation_queue',
      filters: {},
      format: 'CSV',
      acknowledgePII: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
    expect(queryState.reportModerationQueue).not.toHaveBeenCalled();
  });

  it('REL42-MN-07 (negativo): falha simulada do audit → export sofre rollback (INTERNAL, sem payload válido)', async () => {
    identityState.current = { id: 'p-coord', fullName: 'Ana Coordenadora', roles: ['COORDINATOR'] };
    queryState.reportJobs.mockResolvedValue([{ status: 'ACTIVE', count: 1 }]);
    auditState.shouldFail = true;

    const result = await exportReport({ reportType: 'jobs', filters: {}, format: 'CSV', acknowledgePII: false });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL');
      expect('data' in result).toBe(false);
    }
    expect(auditState.events).not.toContain('REPORT_EXPORTED');
  });
});
