import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes unitários da Server Action createCompany (USP-012).
 * Todos os I/O são mockados; sem Postgres real.
 */

const HASH = 'e72b433324098c03e7800f4e71b64605bf7153b914e24f869e74e944835e1200';

// ── Hoisted state ────────────────────────────────────────────────────────────
const state = vi.hoisted(() => ({
  person: null as CurrentPerson | null,
  portalConsentActive: true,
  existingCnpj: false,
  termHash: 'e72b433324098c03e7800f4e71b64605bf7153b914e24f869e74e944835e1200',
  withAuditShouldThrow: null as Error | null,
}));

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-real-ip': '1.2.3.4', 'user-agent': 'vitest' })),
}));

vi.mock('@/modules/identity', () => ({
  getCurrentPerson: vi.fn(async () => state.person),
}));

vi.mock('@/modules/consents', () => ({
  requireActiveConsent: vi.fn(async () => ({ active: state.portalConsentActive })),
  loadTerm: vi.fn(async () => ({
    version: 'v1.0',
    hash: state.termHash,
    content: 'termo',
    effectiveDate: null,
    legalBasis: null,
    status: null,
    purpose: 'COMPANY_REPRESENTATION',
  })),
}));

vi.mock('@/modules/audit', () => ({
  AuditEvent: { COMPANY_CREATED: 'COMPANY_CREATED' },
  withAudit: vi.fn(async (_event: unknown, fn: (tx: unknown, audit: Record<string, unknown>) => Promise<unknown>) => {
    if (state.withAuditShouldThrow) throw state.withAuditShouldThrow;
    const tx = {
      company: {
        create: vi.fn(async () => ({
          id: 'company-uuid',
          cnpj: '11222333000181',
          razaoSocial: 'Empresa Ltda',
        })),
      },
      personCompanyGrant: { create: vi.fn(async () => ({})) },
      consent: { create: vi.fn(async () => ({})) },
    };
    const audit: Record<string, unknown> = {};
    return fn(tx, audit);
  }),
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    company: {
      findUnique: vi.fn(async () => (state.existingCnpj ? { id: 'existing' } : null)),
    },
  },
}));

vi.mock('@/shared/lib/clientIp', () => ({
  clientIp: vi.fn(() => '1.2.3.4'),
}));

const { createCompany } = await import('../actions/create-company');

// ── Helpers ──────────────────────────────────────────────────────────────────
function makePerson(): CurrentPerson {
  return {
    id: 'person-uuid',
    supabaseUserId: 'supa-uuid',
    fullName: 'Teste',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['CANDIDATE'],
    phone: null,
    fullAddress: null,
  };
}

const VALID_INPUT = {
  cnpj: '11.222.333/0001-81',
  type: 'SIMPLES_NACIONAL' as const,
  razaoSocial: 'Empresa Ltda',
  nomeFantasia: 'Empresa',
  setor: 'Tecnologia',
  companyRepresentationTermVersion: 'v1.0',
  companyRepresentationTermHash: HASH,
};

beforeEach(() => {
  state.person = makePerson();
  state.portalConsentActive = true;
  state.existingCnpj = false;
  state.termHash = HASH;
  state.withAuditShouldThrow = null;
});

// ── Testes ───────────────────────────────────────────────────────────────────
describe('createCompany', () => {
  it('happy path: retorna companyId, cnpj e razaoSocial', async () => {
    const result = await createCompany(VALID_INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.companyId).toBe('company-uuid');
    expect(result.data.cnpj).toBe('11222333000181');
  });

  it('VALIDATION: CNPJ inválido', async () => {
    const result = await createCompany({ ...VALID_INPUT, cnpj: '11.222.333/0001-99' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });

  it('VALIDATION: hash do termo fabricado pelo cliente', async () => {
    state.termHash = 'hash-real-do-servidor-que-difere';
    const result = await createCompany({ ...VALID_INPUT, companyRepresentationTermHash: 'a'.repeat(64) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
    expect(result.error.message).toContain('Hash do termo');
  });

  it('UNAUTHENTICATED: sem sessão', async () => {
    state.person = null;
    const result = await createCompany(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNAUTHENTICATED');
  });

  it('CONSENT_REQUIRED: sem PORTAL_ACCESS ativo', async () => {
    state.portalConsentActive = false;
    const result = await createCompany(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CONSENT_REQUIRED');
  });

  it('CONFLICT: CNPJ já cadastrado (pré-verificação)', async () => {
    state.existingCnpj = true;
    const result = await createCompany(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CONFLICT');
    expect(result.error.message).toContain('solicitar sua inclusão');
  });

  it('CONFLICT: corrida de CNPJ duplicado (P2002)', async () => {
    // Forma real do PrismaClientKnownRequestError de P2002 (Prisma 5.x / Postgres):
    // `code` + `meta.target`; a mensagem NÃO carrega o nome do índice.
    const p2002 = Object.assign(
      new Error('Unique constraint failed on the fields: (`cnpj`)'),
      { code: 'P2002', meta: { modelName: 'Company', target: ['cnpj'] } },
    );
    state.withAuditShouldThrow = p2002;
    const result = await createCompany(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CONFLICT');
  });

  it('INTERNAL: erro inesperado na persistência', async () => {
    state.withAuditShouldThrow = new Error('boom');
    const result = await createCompany(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INTERNAL');
  });
});
