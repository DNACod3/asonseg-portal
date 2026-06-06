import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit de `activateAdditionalRole` (USP-006) com sessão/auditoria/prisma mockados.
 * Cobre a sequência canônica e os ramos sem tocar o banco: a transação real é
 * coberta pelo `.int.test.ts`.
 */
const idState = vi.hoisted(() => ({
  person: null as null | { id: string; roles: string[] },
}));
const prismaState = vi.hoisted(() => ({ personFindUnique: vi.fn() }));
const auditState = vi.hoisted(() => ({ events: [] as string[], recorder: null as Record<string, unknown> | null }));
const txState = vi.hoisted(() => ({
  grantFindFirst: vi.fn(),
  grantCreate: vi.fn(),
  grantUpdate: vi.fn(),
  personUpdate: vi.fn(),
  consentFindFirst: vi.fn(),
  consentCreate: vi.fn(),
  auditCreate: vi.fn(),
  activeInTx: null as null | { id: string },
  existingGrant: null as null | { id: string },
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '10.0.0.7', 'user-agent': 'vitest' }),
}));

vi.mock('../server/session', () => ({
  getCurrentPerson: async () => idState.person,
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { person: { findUnique: (...a: unknown[]) => prismaState.personFindUnique(...a) } },
}));

vi.mock('@/modules/audit', () => ({
  AuditEvent: { ROLE_GRANT_ACTIVATED: 'ROLE_GRANT_ACTIVATED', CONSENT_GRANTED: 'CONSENT_GRANTED' },
  withAudit: async (
    event: string,
    fn: (tx: unknown, audit: Record<string, unknown>) => Promise<unknown>,
  ) => {
    auditState.events.push(event);
    const recorder: Record<string, unknown> = {};
    const tx = {
      person: { update: txState.personUpdate },
      personRoleGrant: {
        findFirst: (args: { where?: { status?: string } }) =>
          args?.where?.status === 'ACTIVE'
            ? Promise.resolve(txState.activeInTx)
            : Promise.resolve(txState.existingGrant),
        create: txState.grantCreate,
        update: txState.grantUpdate,
      },
      consent: { findFirst: txState.consentFindFirst, create: txState.consentCreate },
      auditLog: { create: txState.auditCreate },
    };
    const result = await fn(tx, recorder);
    auditState.recorder = recorder;
    return result;
  },
}));

const { activateAdditionalRole } = await import('../actions/activate-additional-role');

const base = {
  termVersion: 'v1.0',
  termContentHash: 'a'.repeat(64),
  acceptTerm: true as const,
};

beforeEach(() => {
  idState.person = { id: 'person-1', roles: [] };
  auditState.events = [];
  auditState.recorder = null;
  // Perfil já completo por padrão (sem campos faltantes).
  prismaState.personFindUnique
    .mockReset()
    .mockResolvedValue({ phone: '11999990000', fullAddress: 'Rua X, 123' });
  txState.activeInTx = null;
  txState.existingGrant = null;
  txState.grantCreate.mockReset().mockResolvedValue({ id: 'grant-new' });
  txState.grantUpdate.mockReset().mockResolvedValue({ id: 'grant-new' });
  txState.personUpdate.mockReset().mockResolvedValue({});
  txState.consentFindFirst.mockReset().mockResolvedValue(null);
  txState.consentCreate.mockReset().mockResolvedValue({ id: 'consent-new' });
  txState.auditCreate.mockReset().mockResolvedValue({ id: 1n });
});

describe('identity/activateAdditionalRole', () => {
  it('happy path: ativa papel, cria grant + consent e audita ROLE_GRANT_ACTIVATED', async () => {
    const result = await activateAdditionalRole({ ...base, role: 'CANDIDATE', profile: {} });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ role: 'CANDIDATE', status: 'ACTIVE', nextStep: '/perfil' });
    }
    expect(auditState.events).toContain('ROLE_GRANT_ACTIVATED');
    // Grant criado (não havia) e promovido a ACTIVE.
    expect(txState.grantCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'CANDIDATE', status: 'AWAITING_CONSENT' }) }),
    );
    expect(txState.grantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) }),
    );
    // Consent da finalidade JOB_APPLICATION criado na mesma transação (P-001).
    expect(txState.consentCreate.mock.calls[0]?.[0]?.data).toMatchObject({
      personId: 'person-1',
      purpose: 'JOB_APPLICATION',
      termVersion: 'v1.0',
    });
    // Perfil completo ⇒ não atualiza Person.
    expect(txState.personUpdate).not.toHaveBeenCalled();
  });

  it('mapeamento de papel: PROVIDER cria consent SERVICE_OFFERING', async () => {
    const result = await activateAdditionalRole({ ...base, role: 'PROVIDER', profile: {} });
    expect(result.ok).toBe(true);
    expect(txState.consentCreate.mock.calls[0]?.[0]?.data?.purpose).toBe('SERVICE_OFFERING');
  });

  it('Zod: sem aceite do termo (acceptTerm ausente) → VALIDATION', async () => {
    const result = await activateAdditionalRole({ role: 'CANDIDATE', termVersion: 'v1.0', termContentHash: 'h', profile: {} } as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
    expect(auditState.events).toHaveLength(0);
  });

  it('papel inválido (não público) → VALIDATION', async () => {
    const result = await activateAdditionalRole({ ...base, role: 'COORDINATOR' as never, profile: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('sem sessão → UNAUTHENTICATED (P-002: opera só sobre a Pessoa autenticada)', async () => {
    idState.person = null;
    const result = await activateAdditionalRole({ ...base, role: 'CANDIDATE', profile: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAUTHENTICATED');
    expect(auditState.events).toHaveLength(0);
  });

  it('papel já ativo (pré-checagem) → CONFLICT, sem transação', async () => {
    idState.person = { id: 'person-1', roles: ['CANDIDATE'] };
    const result = await activateAdditionalRole({ ...base, role: 'CANDIDATE', profile: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONFLICT');
    expect(auditState.events).toHaveLength(0);
  });

  it('campo faltante não preenchido → VALIDATION com fieldErrors do campo', async () => {
    prismaState.personFindUnique.mockResolvedValue({ phone: null, fullAddress: 'Rua X, 123' });
    const result = await activateAdditionalRole({ ...base, role: 'CANDIDATE', profile: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION');
      expect(result.error.fieldErrors?.['profile.phone']).toBeTruthy();
    }
    expect(auditState.events).toHaveLength(0);
  });

  it('campo faltante preenchido → completa o perfil e ativa', async () => {
    prismaState.personFindUnique.mockResolvedValue({ phone: null, fullAddress: 'Rua X, 123' });
    const result = await activateAdditionalRole({
      ...base,
      role: 'CANDIDATE',
      profile: { phone: '11988887777' },
    });
    expect(result.ok).toBe(true);
    expect(txState.personUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { phone: '11988887777' } }),
    );
  });

  it('corrida de duplo submit (papel virou ACTIVE na TX) → CONFLICT', async () => {
    txState.activeInTx = { id: 'grant-x' };
    const result = await activateAdditionalRole({ ...base, role: 'CANDIDATE', profile: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONFLICT');
  });
});
