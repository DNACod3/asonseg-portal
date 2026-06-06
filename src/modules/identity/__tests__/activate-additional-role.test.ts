import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';

/**
 * Unit de `activateAdditionalRole` (USP-006) com sessão/auditoria/termo mockados.
 * Cobre a sequência canônica e os ramos sem tocar o banco: a transação real é
 * coberta pelo `.int.test.ts`. O termo é carregado/validado server-side (P-004),
 * então `@/modules/consents` é mockado aqui.
 */
const idState = vi.hoisted(() => ({
  person: null as null | { id: string; roles: string[]; phone: string | null; fullAddress: string | null },
}));
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
const termState = vi.hoisted(() => ({ loadTerm: vi.fn() }));

// Classe de erro do loader compartilhada entre o mock e os testes (instanceof).
const errState = vi.hoisted(() => {
  class TermLoaderError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'TermLoaderError';
      this.code = code;
    }
  }
  return { TermLoaderError };
});

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '10.0.0.7', 'user-agent': 'vitest' }),
}));

vi.mock('../server/session', () => ({
  getCurrentPerson: async () => idState.person,
}));

vi.mock('@/modules/consents', () => ({
  loadTerm: (...a: unknown[]) => termState.loadTerm(...a),
  TermLoaderError: errState.TermLoaderError,
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

// Versão/hash vigentes que o `loadTerm` mockado devolve (server-side). O `base`
// abaixo reproduz exatamente esse aceite (checagem otimista deve passar).
const CURRENT_TERM = { version: 'v1.0', hash: 'a'.repeat(64) };

const base = {
  termVersion: CURRENT_TERM.version,
  termContentHash: CURRENT_TERM.hash,
  acceptTerm: true as const,
};

beforeEach(() => {
  // Perfil já completo por padrão (sem campos faltantes); sessão sem papéis.
  idState.person = { id: 'person-1', roles: [], phone: '11999990000', fullAddress: 'Rua X, 123' };
  auditState.events = [];
  auditState.recorder = null;
  termState.loadTerm.mockReset().mockResolvedValue({
    purpose: 'JOB_APPLICATION',
    version: CURRENT_TERM.version,
    content: 'TERMO da finalidade — corpo.',
    hash: CURRENT_TERM.hash,
    effectiveDate: null,
    legalBasis: null,
    status: null,
  });
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
    // Consent da finalidade JOB_APPLICATION criado na mesma transação (P-001), com
    // a versão/hash do SERVIDOR (term.version/term.hash), não os do cliente (P-004).
    expect(txState.consentCreate.mock.calls[0]?.[0]?.data).toMatchObject({
      personId: 'person-1',
      purpose: 'JOB_APPLICATION',
      termVersion: CURRENT_TERM.version,
      termContentHash: CURRENT_TERM.hash,
    });
    // Perfil completo ⇒ não atualiza Person.
    expect(txState.personUpdate).not.toHaveBeenCalled();
  });

  it('mapeamento de papel: PROVIDER cria consent SERVICE_OFFERING', async () => {
    const result = await activateAdditionalRole({ ...base, role: 'PROVIDER', profile: {} });
    expect(result.ok).toBe(true);
    expect(txState.consentCreate.mock.calls[0]?.[0]?.data?.purpose).toBe('SERVICE_OFFERING');
  });

  it('P-004: termo vigente é carregado server-side e usado no Consent (não o do cliente)', async () => {
    // loadTerm devolve a versão/hash REAIS; o cliente manda os mesmos (aceite válido).
    await activateAdditionalRole({ ...base, role: 'CANDIDATE', profile: {} });
    expect(termState.loadTerm).toHaveBeenCalledWith('JOB_APPLICATION');
  });

  it('P-004: termo indisponível/adulterado (TermLoaderError) → PRECONDITION_FAILED, sem transação', async () => {
    termState.loadTerm.mockRejectedValue(new errState.TermLoaderError('TERM_HASH_MISMATCH', 'integridade'));
    const result = await activateAdditionalRole({ ...base, role: 'CANDIDATE', profile: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PRECONDITION_FAILED');
    expect(auditState.events).toHaveLength(0);
  });

  it('checagem otimista: aceite de versão/hash divergentes do termo vigente → CONFLICT', async () => {
    // O servidor está em v2.0; o cliente aceitou v1.0 (termo mudou entre página e submit).
    termState.loadTerm.mockResolvedValue({
      purpose: 'JOB_APPLICATION',
      version: 'v2.0',
      content: 'novo termo',
      hash: 'b'.repeat(64),
      effectiveDate: null,
      legalBasis: null,
      status: null,
    });
    const result = await activateAdditionalRole({ ...base, role: 'CANDIDATE', profile: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONFLICT');
    expect(auditState.events).toHaveLength(0);
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
    idState.person = { id: 'person-1', roles: ['CANDIDATE'], phone: '11999990000', fullAddress: 'Rua X, 123' };
    const result = await activateAdditionalRole({ ...base, role: 'CANDIDATE', profile: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONFLICT');
    expect(auditState.events).toHaveLength(0);
  });

  it('campo faltante não preenchido → VALIDATION com fieldErrors do campo', async () => {
    idState.person = { id: 'person-1', roles: [], phone: null, fullAddress: 'Rua X, 123' };
    const result = await activateAdditionalRole({ ...base, role: 'CANDIDATE', profile: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION');
      expect(result.error.fieldErrors?.['profile.phone']).toBeTruthy();
    }
    expect(auditState.events).toHaveLength(0);
  });

  it('campo faltante preenchido → completa o perfil e ativa', async () => {
    idState.person = { id: 'person-1', roles: [], phone: null, fullAddress: 'Rua X, 123' };
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

  it('consentimento já ativo (reaproveitamento) → não recria consent nem audita CONSENT_GRANTED', async () => {
    txState.consentFindFirst.mockResolvedValue({ id: 'consent-existente' });
    const result = await activateAdditionalRole({ ...base, role: 'CANDIDATE', profile: {} });

    expect(result.ok).toBe(true);
    // Reaproveita o consent ativo: sem create e sem o log CONSENT_GRANTED interno.
    expect(txState.consentCreate).not.toHaveBeenCalled();
    expect(txState.auditCreate).not.toHaveBeenCalled();
    // Mas o grant ainda é promovido a ACTIVE e o consentId reaproveitado é auditado.
    expect(txState.grantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) }),
    );
    expect(auditState.recorder?.after).toMatchObject({ consentId: 'consent-existente' });
  });

  it('corrida de duplo submit (papel virou ACTIVE na TX) → CONFLICT', async () => {
    txState.activeInTx = { id: 'grant-x' };
    const result = await activateAdditionalRole({ ...base, role: 'CANDIDATE', profile: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONFLICT');
  });

  it('corrida no índice único parcial de consent (P2002) → CONFLICT', async () => {
    txState.consentCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique violation', {
        code: 'P2002',
        clientVersion: '5.0.0',
      }),
    );
    const result = await activateAdditionalRole({ ...base, role: 'CANDIDATE', profile: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONFLICT');
  });

  it('falha inesperada na transação → INTERNAL (catch-all)', async () => {
    txState.grantCreate.mockRejectedValue(new Error('db indisponível'));
    const result = await activateAdditionalRole({ ...base, role: 'CANDIDATE', profile: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INTERNAL');
  });
});
