import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Testes unitários da `issueAccessReport` (USP-043 — relatório de acesso LGPD
 * art. 19) com dependências mockadas. Espelha o padrão de mocking de
 * `identity/__tests__/login.test.ts`: estado hoisted + `vi.mock` de
 * `next/headers`, `@/modules/audit`, `@/modules/identity`, `@/modules/consents`
 * e `@/shared/lib/prisma`, com `await import(...)` da action APÓS os mocks.
 */

// ── Estado mutável compartilhado com as factories de mock (hoisted) ──────────
const auditState = vi.hoisted(() => ({ events: [] as string[], last: null as unknown }));
const prismaState = vi.hoisted(() => ({ findUnique: vi.fn() }));
const identityState = vi.hoisted(() => ({
  current: null as { id: string; roles: string[] } | null,
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '10.0.0.5', 'user-agent': 'vitest' }),
}));

vi.mock('@/modules/audit', () => ({
  AuditEvent: { ACCESS_REPORT_ISSUED: 'ACCESS_REPORT_ISSUED' },
  withAudit: async (
    event: string,
    fn: (tx: unknown, audit: Record<string, unknown>) => Promise<unknown>,
  ) => {
    auditState.events.push(event);
    const recorder: Record<string, unknown> = {};
    const result = await fn({}, recorder);
    auditState.last = recorder;
    return result;
  },
}));

vi.mock('@/modules/identity', () => ({
  getCurrentPerson: async () => identityState.current,
}));

vi.mock('@/modules/consents', () => ({
  purposeMetadata: (purpose: string) => ({
    humanName: `Nome de ${purpose}`,
    description: 'desc',
    legalBasis: 'base',
  }),
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { person: { findUnique: (...args: unknown[]) => prismaState.findUnique(...args) } },
}));

const { issueAccessReport } = await import('../actions/access-report');

const SUBJECT_ID = '11111111-1111-4111-8111-111111111111';

function subjectRow() {
  return {
    id: SUBJECT_ID,
    fullName: 'Maria da Silva',
    cpf: '12345678900',
    emailLogin: 'maria@example.com',
    phone: '11999990000',
    birthDate: new Date('1990-01-15'),
    fullAddress: 'Rua A, 100',
    status: 'ATIVO',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    roleGrants: [
      {
        role: 'CANDIDATE',
        status: 'ACTIVE',
        activatedAt: new Date('2024-02-01T00:00:00Z'),
        revokedAt: null,
      },
    ],
    consents: [
      {
        purpose: 'JOB_APPLICATION',
        termVersion: 'v1',
        acceptedAt: new Date('2024-02-01T00:00:00Z'),
        revokedAt: null,
        revokedReason: null,
      },
      {
        purpose: 'CV_AI_EXTRACTION',
        termVersion: 'v1',
        acceptedAt: new Date('2024-03-01T00:00:00Z'),
        revokedAt: new Date('2024-04-01T00:00:00Z'),
        revokedReason: 'titular solicitou',
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  auditState.events = [];
  auditState.last = null;
  identityState.current = null;
  prismaState.findUnique.mockReset();
});

describe('issueAccessReport', () => {
  it('happy path: papel interno autorizado → ok, consolida perfil + papéis + consentimentos e audita', async () => {
    identityState.current = { id: 'staff-1', roles: ['SOCIAL_ASSISTANT'] };
    prismaState.findUnique.mockResolvedValue(subjectRow());

    const result = await issueAccessReport({ personId: SUBJECT_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.profile.id).toBe(SUBJECT_ID);
      expect(result.data.profile.fullName).toBe('Maria da Silva');
      expect(result.data.issuedByPersonId).toBe('staff-1');
      expect(result.data.roleGrants).toHaveLength(1);
      expect(result.data.consents).toHaveLength(2);
      // nome humano + status derivado
      expect(result.data.consents[0]?.purposeName).toBe('Nome de JOB_APPLICATION');
      expect(result.data.consents[0]?.status).toBe('vigente');
      expect(result.data.consents[1]?.status).toBe('revogado');
      expect(result.data.consents[1]?.revokedReason).toBe('titular solicitou');
    }

    // Emissão auditada com contagens corretas.
    expect(auditState.events).toContain('ACCESS_REPORT_ISSUED');
    expect(auditState.last).toMatchObject({
      entityType: 'person',
      entityId: SUBJECT_ID,
      after: { reportFor: SUBJECT_ID, consents: 2, roleGrants: 1 },
    });
  });

  it('FORBIDDEN: solicitante sem papel interno → erro FORBIDDEN, sem auditar nem ler', async () => {
    identityState.current = { id: 'cand-1', roles: ['CANDIDATE'] };

    const result = await issueAccessReport({ personId: SUBJECT_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
    expect(auditState.events).not.toContain('ACCESS_REPORT_ISSUED');
    expect(prismaState.findUnique).not.toHaveBeenCalled();
  });

  it('UNAUTHENTICATED: sem sessão (getCurrentPerson → null)', async () => {
    identityState.current = null;

    const result = await issueAccessReport({ personId: SUBJECT_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHENTICATED');
    expect(prismaState.findUnique).not.toHaveBeenCalled();
    expect(auditState.events).not.toContain('ACCESS_REPORT_ISSUED');
  });

  it('NOT_FOUND: titular inexistente', async () => {
    identityState.current = { id: 'staff-1', roles: ['BOARD'] };
    prismaState.findUnique.mockResolvedValue(null);

    const result = await issueAccessReport({ personId: SUBJECT_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND');
    expect(auditState.events).not.toContain('ACCESS_REPORT_ISSUED');
  });

  it('VALIDATION: personId malformado → erro de validação, sem checar sessão', async () => {
    const result = await issueAccessReport({ personId: 'nao-uuid' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION');
      expect(result.error.fieldErrors?.personId).toBeDefined();
    }
    expect(prismaState.findUnique).not.toHaveBeenCalled();
  });
});
