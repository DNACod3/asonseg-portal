import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit de `revokeConsent`: cascata para o papel, isolamento de finalidade,
 * idempotência (sem auditar no-op) e justificativa obrigatória (CONSENT_REVOKED).
 *
 * USP-053 / CAND-7: estende a cascata de artefatos de `JOB_APPLICATION`
 * (ENCERRAR+MARCAR candidaturas + OCULTAR perfil). O applier
 * (`REVOCATION_EFFECTS_TOKEN`) é mockado via `container.resolve` — não passa
 * pelo mock de `tx` — mantendo este teste isolado do DB (comportamento real
 * provado no int fim-a-fim, `revoke-consent.int.test.ts`).
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
const applierState = vi.hoisted(() => ({
  applyJobApplicationCascade: vi.fn(async () => ({
    applicationsEnded: 0,
    endedApplicationIds: [] as string[],
    profileHidden: false,
  })),
}));
const containerState = vi.hoisted(() => ({ resolve: vi.fn() }));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest' }),
}));

vi.mock('@/modules/identity', () => ({
  getCurrentPerson: async () => idState.person,
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { consent: { findFirst: (...a: unknown[]) => prismaState.consentFindFirst(...a) } },
}));

// `createToken` é usado por `../ports/revocation-effects` (importado
// transitivamente por `revoke-consent.ts`) — reimplementado trivialmente
// (mesma lógica de `shared/container.ts`) para não depender do módulo real.
vi.mock('@/shared/container', () => ({
  createToken: (description: string) => Symbol(description),
  container: { resolve: (token: unknown) => containerState.resolve(token) },
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
  applierState.applyJobApplicationCascade
    .mockReset()
    .mockResolvedValue({ applicationsEnded: 0, endedApplicationIds: [], profileHidden: false });
  containerState.resolve.mockReset().mockReturnValue(applierState);
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

  it('USP053-01/02/03: JOB_APPLICATION revogado resolve o applier na tx e propaga o resultado no after e no retorno', async () => {
    applierState.applyJobApplicationCascade.mockResolvedValue({
      applicationsEnded: 2,
      endedApplicationIds: ['app-1', 'app-2'],
      profileHidden: true,
    });

    const result = await revokeConsent({ purpose: 'JOB_APPLICATION', reason: 'Não quero mais' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({ applicationsEnded: 2, profileHidden: true });
    }
    expect(applierState.applyJobApplicationCascade).toHaveBeenCalledTimes(1);
    expect(applierState.applyJobApplicationCascade).toHaveBeenCalledWith(
      // A mesma tx do callback de withAudit — mesma referência de updateMany.
      expect.objectContaining({ consent: expect.objectContaining({ updateMany: txState.consentUpdateMany }) }),
      expect.objectContaining({
        personId: 'person-1',
        actorPersonId: 'person-1',
        ip: '10.0.0.9',
        userAgent: 'vitest',
        justification: 'Não quero mais',
      }),
    );
    expect(auditState.recorder?.after).toMatchObject({ applicationsEnded: 2, profileHidden: true });
  });

  it('USP053-MN-06: finalidade ≠ JOB_APPLICATION → o applier NÃO é chamado; after zera os campos da cascata', async () => {
    const result = await revokeConsent({ purpose: 'CV_AI_EXTRACTION' });
    expect(result.ok).toBe(true);
    expect(auditState.recorder?.justification).toMatch(/titular/i);
    expect(txState.grantUpdateMany).not.toHaveBeenCalled();
    expect(applierState.applyJobApplicationCascade).not.toHaveBeenCalled();
    expect(auditState.recorder?.after).toMatchObject({ applicationsEnded: 0, profileHidden: false });
    if (result.ok) expect(result.data).toMatchObject({ applicationsEnded: 0, profileHidden: false });
  });

  it('idempotente: finalidade já revogada não abre transação auditada nem chama o applier', async () => {
    prismaState.consentFindFirst.mockImplementation(consentFindFirstImpl(null, { id: 'old' }));

    const result = await revokeConsent({ purpose: 'JOB_APPLICATION' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        consentsRevoked: 0,
        alreadyRevoked: true,
        applicationsEnded: 0,
        profileHidden: false,
      });
    }
    expect(auditState.events).toHaveLength(0); // sem CONSENT_REVOKED espúrio
    expect(txState.consentUpdateMany).not.toHaveBeenCalled();
    expect(txState.grantUpdateMany).not.toHaveBeenCalled();
    expect(applierState.applyJobApplicationCascade).not.toHaveBeenCalled();
  });

  it('finalidade nunca consentida → NOT_FOUND, sem auditoria nem applier', async () => {
    prismaState.consentFindFirst.mockImplementation(consentFindFirstImpl(null, null));

    const result = await revokeConsent({ purpose: 'SERVICE_OFFERING' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND');
    expect(auditState.events).toHaveLength(0);
    expect(applierState.applyJobApplicationCascade).not.toHaveBeenCalled();
  });

  it('sem sessão → UNAUTHENTICATED', async () => {
    idState.person = null;
    const result = await revokeConsent({ purpose: 'JOB_APPLICATION' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHENTICATED');
  });
});
