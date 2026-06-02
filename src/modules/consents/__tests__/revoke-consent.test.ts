import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit de `revokeConsent`: cascata para o papel, isolamento de finalidade,
 * idempotência (sem auditar no-op) e justificativa obrigatória (CONSENT_REVOKED).
 */
const idState = vi.hoisted(() => ({ person: null as null | { id: string } }));
const auditState = vi.hoisted(() => ({
  events: [] as string[],
  recorder: null as Record<string, unknown> | null,
}));
const prismaState = vi.hoisted(() => ({ consentFindFirst: vi.fn() }));
const txState = vi.hoisted(() => ({
  consentUpdateMany: vi.fn(),
  grantUpdateMany: vi.fn(),
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
    CONSENT_REVOKED: 'CONSENT_REVOKED',
    ROLE_GRANT_REVOKED: 'ROLE_GRANT_REVOKED',
  },
  withAudit: async (
    event: string,
    fn: (tx: unknown, audit: Record<string, unknown>) => Promise<unknown>,
  ) => {
    auditState.events.push(event);
    const recorder: Record<string, unknown> = {};
    const tx = {
      consent: { updateMany: txState.consentUpdateMany },
      personRoleGrant: { updateMany: txState.grantUpdateMany },
      auditLog: { create: txState.auditCreate },
    };
    const result = await fn(tx, recorder);
    // Espelha a regra real: CONSENT_REVOKED exige justificativa.
    if (!recorder.justification) throw new Error('justificativa obrigatória');
    auditState.recorder = recorder;
    return result;
  },
}));

const { revokeConsent } = await import('../actions/revoke-consent');

/** Pré-checagem: `revokedAt: null` ⇒ registro vigente; senão ⇒ "qualquer". */
function consentFindFirstImpl(active: unknown, any: unknown) {
  return async (args: { where: { revokedAt?: null } }) =>
    args.where.revokedAt === null ? active : any;
}

beforeEach(() => {
  idState.person = { id: 'person-1' };
  auditState.events = [];
  auditState.recorder = null;
  prismaState.consentFindFirst
    .mockReset()
    .mockImplementation(consentFindFirstImpl({ id: 'active' }, { id: 'active' }));
  txState.consentUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  txState.grantUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  txState.auditCreate.mockReset().mockResolvedValue({ id: 1n });
});

describe('consents/revokeConsent', () => {
  it('revoga finalidade vigente e cascateia o papel para REVOKED', async () => {
    const result = await revokeConsent({ purpose: 'JOB_APPLICATION', reason: 'Não quero mais' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({ purpose: 'JOB_APPLICATION', consentsRevoked: 1, roleRevoked: true });
    }
    expect(auditState.events).toContain('CONSENT_REVOKED');
    expect(auditState.recorder?.justification).toBe('Não quero mais');
    expect(txState.consentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ purpose: 'JOB_APPLICATION', revokedAt: null }) }),
    );
    expect(txState.grantUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ role: 'CANDIDATE', status: 'ACTIVE' }) }),
    );
  });

  it('usa justificativa padrão quando o motivo é omitido e não cascateia finalidade sem papel', async () => {
    const result = await revokeConsent({ purpose: 'CV_AI_EXTRACTION' });
    expect(result.ok).toBe(true);
    expect(auditState.recorder?.justification).toMatch(/titular/i);
    expect(txState.grantUpdateMany).not.toHaveBeenCalled();
  });

  it('idempotente: finalidade já revogada não abre transação auditada', async () => {
    prismaState.consentFindFirst.mockImplementation(consentFindFirstImpl(null, { id: 'old' }));

    const result = await revokeConsent({ purpose: 'JOB_APPLICATION' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ consentsRevoked: 0, alreadyRevoked: true });
    expect(auditState.events).toHaveLength(0); // sem CONSENT_REVOKED espúrio
    expect(txState.consentUpdateMany).not.toHaveBeenCalled();
    expect(txState.grantUpdateMany).not.toHaveBeenCalled();
  });

  it('finalidade nunca consentida → NOT_FOUND, sem auditoria', async () => {
    prismaState.consentFindFirst.mockImplementation(consentFindFirstImpl(null, null));

    const result = await revokeConsent({ purpose: 'SERVICE_OFFERING' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND');
    expect(auditState.events).toHaveLength(0);
  });

  it('sem sessão → UNAUTHENTICATED', async () => {
    idState.person = null;
    const result = await revokeConsent({ purpose: 'JOB_APPLICATION' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHENTICATED');
  });
});
