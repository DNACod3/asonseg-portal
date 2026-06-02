import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';

/**
 * Unit de `grantConsent` com auditoria/identidade/prisma mockados.
 * `loadTerm` lê os arquivos reais de `legal/consent-terms/` (hash real).
 */
const idState = vi.hoisted(() => ({ person: null as null | { id: string } }));
const auditState = vi.hoisted(() => ({
  events: [] as string[],
  recorder: null as Record<string, unknown> | null,
}));
const prismaState = vi.hoisted(() => ({ consentFindFirst: vi.fn() }));
const txState = vi.hoisted(() => ({
  consentCreate: vi.fn(),
  grantFindFirst: vi.fn(),
  grantUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest' }),
}));

vi.mock('@/modules/identity', () => ({
  getCurrentPerson: async () => idState.person,
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { consent: { findFirst: (...a: unknown[]) => prismaState.consentFindFirst(...a) } },
}));

vi.mock('@/modules/audit', () => ({
  AuditEvent: {
    CONSENT_GRANTED: 'CONSENT_GRANTED',
    ROLE_GRANT_ACTIVATED: 'ROLE_GRANT_ACTIVATED',
  },
  withAudit: async (
    event: string,
    fn: (tx: unknown, audit: Record<string, unknown>) => Promise<unknown>,
  ) => {
    auditState.events.push(event);
    const recorder: Record<string, unknown> = {};
    const tx = {
      consent: { create: txState.consentCreate },
      personRoleGrant: { findFirst: txState.grantFindFirst, update: txState.grantUpdate },
      auditLog: { create: txState.auditCreate },
    };
    const result = await fn(tx, recorder);
    auditState.recorder = recorder;
    return result;
  },
}));

const { grantConsent } = await import('../actions/grant-consent');

beforeEach(() => {
  idState.person = { id: 'person-1' };
  auditState.events = [];
  auditState.recorder = null;
  prismaState.consentFindFirst.mockReset().mockResolvedValue(null); // requireActiveConsent → ABSENT
  txState.consentCreate.mockReset().mockResolvedValue({ id: 'c-new' });
  txState.grantFindFirst.mockReset().mockResolvedValue(null);
  txState.grantUpdate.mockReset().mockResolvedValue({ id: 'g1' });
  txState.auditCreate.mockReset().mockResolvedValue({ id: 1n });
});

describe('consents/grantConsent', () => {
  it('happy path: registra consentimento na versão vigente sob CONSENT_GRANTED', async () => {
    const result = await grantConsent({ purpose: 'JOB_APPLICATION' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        purpose: 'JOB_APPLICATION',
        termVersion: 'v1.0',
        alreadyActive: false,
        roleReactivated: false,
      });
    }
    expect(auditState.events).toContain('CONSENT_GRANTED');
    const created = txState.consentCreate.mock.calls[0]?.[0]?.data;
    expect(created).toMatchObject({ personId: 'person-1', purpose: 'JOB_APPLICATION', termVersion: 'v1.0' });
    expect(created.termContentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(created.acceptedIp).toBe('10.0.0.9');
  });

  it('idempotente: consentimento já ativo na versão vigente não duplica', async () => {
    prismaState.consentFindFirst.mockImplementation(async (args: { where: { revokedAt?: null } }) =>
      args.where.revokedAt === null ? { id: 'c-existing', termVersion: 'v1.0' } : null,
    );

    const result = await grantConsent({ purpose: 'JOB_APPLICATION' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({ consentId: 'c-existing', alreadyActive: true });
    }
    expect(auditState.events).toHaveLength(0);
    expect(txState.consentCreate).not.toHaveBeenCalled();
  });

  it('reativa grant de papel pendente/revogado no re-aceite (P-006)', async () => {
    txState.grantFindFirst.mockResolvedValue({ id: 'grant-9' });

    const result = await grantConsent({ purpose: 'JOB_APPLICATION' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.roleReactivated).toBe(true);
    expect(txState.grantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'grant-9' }, data: expect.objectContaining({ status: 'ACTIVE' }) }),
    );
    const auditActions = txState.auditCreate.mock.calls.map((c) => c[0]?.data?.action);
    expect(auditActions).toContain('ROLE_GRANT_ACTIVATED');
  });

  it('corrida (P2002 do índice único parcial) resolve como idempotente', async () => {
    // Pré-checagem: ABSENT (2 findFirst null) → segue para criar. Após o P2002,
    // a re-leitura encontra o vencedor da corrida → ok alreadyActive.
    let calls = 0;
    prismaState.consentFindFirst.mockReset().mockImplementation(
      async (args: { where: { revokedAt?: null } }) => {
        calls += 1;
        if (calls >= 3 && args.where.revokedAt === null) {
          return { id: 'c-winner', termVersion: 'v1.0' };
        }
        return null;
      },
    );
    txState.consentCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' }),
    );

    const result = await grantConsent({ purpose: 'JOB_APPLICATION' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({ consentId: 'c-winner', alreadyActive: true });
    }
  });

  it('finalidade inválida → VALIDATION', async () => {
    const result = await grantConsent({ purpose: 'NOT_A_PURPOSE' as never });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
    expect(auditState.events).toHaveLength(0);
  });

  it('sem sessão → UNAUTHENTICATED', async () => {
    idState.person = null;
    const result = await grantConsent({ purpose: 'JOB_APPLICATION' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHENTICATED');
  });
});
