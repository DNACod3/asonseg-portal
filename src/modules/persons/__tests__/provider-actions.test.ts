import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Unit da Server Action do cadastro de prestador (USP-010 #114) com
 * sessão/consentimento/auditoria/prisma mockados — cobre a sequência canônica e
 * todos os ramos sem tocar o banco. A transação real (Postgres) fica no
 * `provider-actions.int.test.ts`.
 *
 * Diferença vs. USP-009: papel PROVIDER ativo IMEDIATAMENTE, SEM moderação
 * (ADR-0015) — não há `transitionContent`. Sem coleta de CNPJ (ADR-0031).
 */

const sessionState = vi.hoisted(() => ({ person: null as CurrentPerson | null }));
const consentState = vi.hoisted(() => ({ active: new Set<string>() }));
const auditState = vi.hoisted(() => ({
  events: [] as string[],
  recorder: null as Record<string, unknown> | null,
}));
const txState = vi.hoisted(() => ({ upsert: vi.fn(), throwOnAudit: false }));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest' }),
}));

vi.mock('@/modules/identity', () => ({
  getCurrentPerson: async () => sessionState.person,
}));

vi.mock('@/modules/consents', () => ({
  requireActiveConsent: async (_personId: string, purpose: string) => ({
    active: consentState.active.has(purpose),
  }),
}));

vi.mock('@/modules/audit', () => ({
  AuditEvent: { PROVIDER_ROLE_ACTIVATED: 'PROVIDER_ROLE_ACTIVATED' },
  withAudit: async (
    event: string,
    fn: (tx: unknown, audit: Record<string, unknown>) => Promise<unknown>,
  ) => {
    auditState.events.push(event);
    if (txState.throwOnAudit) throw new Error('db indisponível');
    const recorder: Record<string, unknown> = {};
    const tx = { providerProfile: { upsert: txState.upsert } };
    const result = await fn(tx, recorder);
    auditState.recorder = recorder;
    return result;
  },
}));

const { activateProviderRole } = await import('../actions/activate-provider-role');

function person(id = 'person-1'): CurrentPerson {
  return {
    id,
    supabaseUserId: '00000000-0000-0000-0000-0000000000aa',
    fullName: 'Prestador Unit',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['PROVIDER'],
    phone: null,
    fullAddress: null,
  };
}

const REGION_ID = '00000000-0000-0000-0000-000000000001';
const validInput = () => ({
  headline: 'Eletricista predial',
  description: 'Instalações e manutenção elétrica residencial.',
  regionId: REGION_ID,
});

beforeEach(() => {
  sessionState.person = person();
  consentState.active = new Set(['PORTAL_ACCESS', 'SERVICE_OFFERING']);
  auditState.events = [];
  auditState.recorder = null;
  txState.upsert.mockReset().mockResolvedValue({});
  txState.throwOnAudit = false;
});

describe('persons/activateProviderRole', () => {
  it('E-001 happy path (perfil mínimo): cria perfil em DRAFT, audita e mapeia opcionais para null', async () => {
    const res = await activateProviderRole({});

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual({ personId: 'person-1', publicationStatus: 'DRAFT' });
    expect(auditState.events).toContain('PROVIDER_ROLE_ACTIVATED');
    const createData = txState.upsert.mock.calls[0]?.[0]?.create;
    expect(createData).toMatchObject({
      personId: 'person-1',
      headline: null,
      description: null,
      regionId: null,
    });
    expect(auditState.recorder?.after).toMatchObject({ publicationStatus: 'DRAFT' });
  });

  it('E-001 happy path (com opcionais): ramo "presente" dos defaults é exercido', async () => {
    const res = await activateProviderRole(validInput());

    expect(res.ok).toBe(true);
    const updateData = txState.upsert.mock.calls[0]?.[0]?.update;
    expect(updateData).toMatchObject({
      headline: 'Eletricista predial',
      description: 'Instalações e manutenção elétrica residencial.',
      regionId: REGION_ID,
    });
  });

  it('E-002 (ADR-0031): cnpjMei no input é descartado — perfil não persiste CNPJ', async () => {
    const res = await activateProviderRole({ ...validInput(), cnpjMei: '12345678000195' } as never);
    expect(res.ok).toBe(true);
    const createOrUpdate = txState.upsert.mock.calls[0]?.[0];
    expect(JSON.stringify(createOrUpdate)).not.toContain('cnpj');
  });

  it('Zod: regionId inválido → VALIDATION, sem auditoria', async () => {
    const res = await activateProviderRole({ regionId: 'nao-e-uuid' } as never);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('VALIDATION');
    expect(auditState.events).toHaveLength(0);
    expect(txState.upsert).not.toHaveBeenCalled();
  });

  it('P-005: sem sessão → UNAUTHENTICATED', async () => {
    sessionState.person = null;
    const res = await activateProviderRole(validInput());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('UNAUTHENTICATED');
    expect(auditState.events).toHaveLength(0);
  });

  it('P-003: consentimento ausente (PORTAL_ACCESS) → CONSENT_REQUIRED', async () => {
    consentState.active = new Set(['SERVICE_OFFERING']);
    const res = await activateProviderRole(validInput());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('CONSENT_REQUIRED');
    expect(txState.upsert).not.toHaveBeenCalled();
  });

  it('P-003: consentimento ausente (SERVICE_OFFERING) → CONSENT_REQUIRED', async () => {
    consentState.active = new Set(['PORTAL_ACCESS']);
    const res = await activateProviderRole(validInput());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('CONSENT_REQUIRED');
  });

  it('idempotência: reativar usa upsert por personId (não duplica)', async () => {
    await activateProviderRole(validInput());
    await activateProviderRole(validInput());
    expect(txState.upsert).toHaveBeenCalledTimes(2);
    expect(txState.upsert.mock.calls[0]?.[0]?.where).toEqual({ personId: 'person-1' });
  });

  it('IP "unknown" do header → persiste como null (ramo do clientIp)', async () => {
    const res = await activateProviderRole(validInput());
    expect(res.ok).toBe(true);
  });

  it('falha inesperada na transação → INTERNAL (catch-all)', async () => {
    txState.throwOnAudit = true;
    const res = await activateProviderRole(validInput());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('INTERNAL');
  });
});
