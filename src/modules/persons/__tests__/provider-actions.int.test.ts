import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração da Server Action do cadastro de prestador (USP-010 #114).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Real: Prisma/Postgres — persistência do ProviderProfile e a guarda de
 * consentimento. Sem moderação (ADR-0015) e sem CNPJ (ADR-0031). Mocks:
 * next/headers e session (pessoa autenticada).
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.3', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;
vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { activateProviderRole } = await import('../actions/activate-provider-role');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('USP-010 #114 — cadastro de prestador (integração)', () => {
  let personId = '';
  let personNoConsentId = '';
  let regionId = '';

  const baseInput = () => ({
    headline: 'Eletricista predial',
    description: 'Instalações e manutenção elétrica residencial.',
    regionId,
  });

  function baseMockPerson(id: string): CurrentPerson {
    return {
      id,
      supabaseUserId: '00000000-0000-0000-0000-0000000000aa',
      fullName: 'Prestador Int',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles: ['PROVIDER'],
      phone: null,
      fullAddress: null,
    };
  }

  beforeAll(async () => {
    const region = await prisma.region.create({
      data: { name: `Região Teste USP010 ${Date.now()}`, cityName: 'Florianópolis' },
      select: { id: true },
    });
    regionId = region.id;

    const person = await prisma.person.create({
      data: { fullName: 'Prestador Int', status: 'ATIVO' },
      select: { id: true },
    });
    personId = person.id;
    await prisma.consent.createMany({
      data: [
        { personId, purpose: 'PORTAL_ACCESS', termVersion: 'v1.0', termContentHash: 'x' },
        { personId, purpose: 'SERVICE_OFFERING', termVersion: 'v1.0', termContentHash: 'x' },
      ],
    });

    const p2 = await prisma.person.create({
      data: { fullName: 'Sem Consent Int', status: 'ATIVO' },
      select: { id: true },
    });
    personNoConsentId = p2.id;
    await prisma.consent.create({
      data: { personId: personNoConsentId, purpose: 'PORTAL_ACCESS', termVersion: 'v1.0', termContentHash: 'x' },
    });

    mockPerson = baseMockPerson(personId);
  });

  afterAll(async () => {
    await prisma.providerProfile.deleteMany({ where: { personId: { in: [personId, personNoConsentId] } } });
    await prisma.consent.deleteMany({ where: { personId: { in: [personId, personNoConsentId] } } });
    await prisma.person.deleteMany({ where: { id: { in: [personId, personNoConsentId] } } });
    await prisma.region.deleteMany({ where: { id: regionId } });
  });

  it('E-001 happy path: cria ProviderProfile em DRAFT', async () => {
    mockPerson = baseMockPerson(personId);
    const res = await activateProviderRole(baseInput());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.publicationStatus).toBe('DRAFT');
    const profile = await prisma.providerProfile.findUnique({ where: { personId } });
    expect(profile?.publicationStatus).toBe('DRAFT');
    expect(profile?.regionId).toBe(regionId);
  });

  it('E-001 permissão: recusa não autenticado (UNAUTHENTICATED)', async () => {
    mockPerson = null;
    const res = await activateProviderRole(baseInput());
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('UNAUTHENTICATED');
  });

  it('P-003 consentimento ausente: bloqueia com CONSENT_REQUIRED', async () => {
    mockPerson = baseMockPerson(personNoConsentId);
    const res = await activateProviderRole(baseInput());
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('CONSENT_REQUIRED');
  });

  it('E-001 idempotência: reativar não duplica o perfil', async () => {
    mockPerson = baseMockPerson(personId);
    await activateProviderRole({ ...baseInput(), headline: 'Atualizado' });
    const count = await prisma.providerProfile.count({ where: { personId } });
    expect(count).toBe(1);
  });
});
