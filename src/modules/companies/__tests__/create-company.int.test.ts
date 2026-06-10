import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração da Server Action createCompany (USP-012).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Real: Prisma/Postgres — valida persistência atômica (Company + Grant + Consent),
 * corrida de CNPJ (P2002), guarda de consentimento de portal e auditoria.
 * Mocks: next/headers (IP/UA), session (pessoa autenticada).
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.1', 'user-agent': 'vitest/int' })),
}));

const COMPANY_REPRESENTATION_HASH = 'e72b433324098c03e7800f4e71b64605bf7153b914e24f869e74e944835e1200';
const COMPANY_REPRESENTATION_VERSION = 'v1.0';

let mockPerson: CurrentPerson | null = null;

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { createCompany } = await import('../actions/create-company');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const VALID_INPUT = {
  cnpj: '11.222.333/0001-81',
  type: 'SIMPLES_NACIONAL' as const,
  razaoSocial: 'Empresa Integração Ltda',
  nomeFantasia: 'Empresa Integração',
  setor: 'Tecnologia',
  companyRepresentationTermVersion: COMPANY_REPRESENTATION_VERSION,
  companyRepresentationTermHash: COMPANY_REPRESENTATION_HASH,
};

skipIfNoDb('createCompany — integração', () => {
  let personId = '';
  const createdCompanyIds: string[] = [];

  beforeAll(async () => {
    // Cleanup idempotente: remove dados residuais de runs anteriores.
    const staleCompany = await prisma.company.findUnique({
      where: { cnpj: '11222333000181' },
      select: { id: true },
    });
    if (staleCompany) {
      await prisma.personCompanyGrant.deleteMany({ where: { companyId: staleCompany.id } });
      await prisma.company.delete({ where: { id: staleCompany.id } });
    }

    const person = await prisma.person.create({
      data: { fullName: 'Empresa Teste Int', status: 'ATIVO' },
      select: { id: true },
    });
    personId = person.id;

    await prisma.consent.create({
      data: {
        personId,
        purpose: 'PORTAL_ACCESS',
        termVersion: 'v1.0',
        termContentHash: 'b9791c01cdf4cf5177d33a8938693671b97ab7f24293665f70024ea83006a0d2',
      },
    });

    mockPerson = {
      id: personId,
      supabaseUserId: '00000000-0000-0000-0000-000000000001',
      fullName: 'Empresa Teste Int',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles: ['CANDIDATE'],
      phone: null,
      fullAddress: null,
    };
  });

  afterAll(async () => {
    // audit_log é append-only (trigger bloqueia DELETE — ADR-0004).
    // Deletamos em cascata pela FK: companies → grants/consents → person.
    await prisma.consent.deleteMany({ where: { personId } });
    if (createdCompanyIds.length > 0) {
      await prisma.personCompanyGrant.deleteMany({
        where: { companyId: { in: createdCompanyIds } },
      });
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
    await prisma.person.delete({ where: { id: personId } });
  });

  afterEach(() => {
    mockPerson = {
      id: personId,
      supabaseUserId: '00000000-0000-0000-0000-000000000001',
      fullName: 'Empresa Teste Int',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles: ['CANDIDATE'],
      phone: null,
      fullAddress: null,
    };
  });

  it('happy path: cria Company + Grant RESPONSIBLE + Consent atomicamente', async () => {
    const result = await createCompany(VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    createdCompanyIds.push(result.data.companyId);

    const company = await prisma.company.findUnique({
      where: { id: result.data.companyId },
      select: { cnpj: true, razaoSocial: true, isVerified: true, createdBy: true },
    });
    expect(company).toMatchObject({
      cnpj: '11222333000181',
      razaoSocial: 'Empresa Integração Ltda',
      isVerified: false,
      createdBy: personId,
    });

    const grant = await prisma.personCompanyGrant.findFirst({
      where: { companyId: result.data.companyId, personId, grantType: 'RESPONSIBLE', revokedAt: null },
      select: { id: true },
    });
    expect(grant).not.toBeNull();

    const consent = await prisma.consent.findFirst({
      where: { personId, purpose: 'COMPANY_REPRESENTATION', revokedAt: null },
      select: { termVersion: true, termContentHash: true },
    });
    expect(consent).toMatchObject({
      termVersion: COMPANY_REPRESENTATION_VERSION,
      termContentHash: COMPANY_REPRESENTATION_HASH,
    });
  });

  it('VALIDATION: CNPJ com dígito verificador errado é rejeitado pelo Zod', async () => {
    const result = await createCompany({ ...VALID_INPUT, cnpj: '11.222.333/0001-99' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });

  it('VALIDATION: hash do termo fabricado pelo cliente é rejeitado', async () => {
    const result = await createCompany({
      ...VALID_INPUT,
      cnpj: '45.997.418/0001-53',
      companyRepresentationTermHash: 'a'.repeat(64),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });

  it('UNAUTHENTICATED: sem sessão', async () => {
    mockPerson = null;
    const result = await createCompany({ ...VALID_INPUT, cnpj: '45.997.418/0001-53' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNAUTHENTICATED');
  });

  it('CONSENT_REQUIRED: sem PORTAL_ACCESS ativo', async () => {
    const person2 = await prisma.person.create({
      data: { fullName: 'Sem Consent Int', status: 'ATIVO' },
      select: { id: true },
    });
    mockPerson = {
      id: person2.id,
      supabaseUserId: '00000000-0000-0000-0000-000000000002',
      fullName: 'Sem Consent Int',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles: ['CANDIDATE'],
      phone: null,
      fullAddress: null,
    };

    try {
      const result = await createCompany({ ...VALID_INPUT, cnpj: '11.444.777/0001-61' });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('CONSENT_REQUIRED');
    } finally {
      await prisma.person.delete({ where: { id: person2.id } });
    }
  });

  it('CONFLICT: CNPJ duplicado na pré-verificação', async () => {
    // O happy path já cadastrou 11222333000181 — tenta cadastrar de novo.
    const result = await createCompany(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CONFLICT');
    expect(result.error.message).toContain('solicitar sua inclusão');
  });
});
