import { randomUUID } from 'node:crypto';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `createServiceDraft` — validação de posse+formato de
 * `photoStoragePaths` (F3/MN-F3, review PR #284). Requer Postgres local
 * (`supabase start`). Espelha o padrão de fixture/cleanup de
 * `submit-service.int.test.ts` / `search-services.int.test.ts`.
 *
 * Cobre: path de outro `person.id` (misatribuição) → VALIDATION, zero serviços
 * criados; path malformado (`../`) → VALIDATION, zero serviços criados; path
 * próprio válido → ok, linha `ServicePhoto` criada.
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
const { createServiceDraft } = await import('../actions/create-service-draft');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

function personFixture(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: '00000000-0000-0000-0000-0000000000ee',
    fullName: 'Prestador Photo-Path Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['PROVIDER'],
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('createServiceDraft — validação de posse/formato de photoStoragePaths (F3)', () => {
  let providerId = '';
  let otherPersonId = '';

  beforeAll(async () => {
    const provider = await prisma.person.create({
      data: { fullName: 'Provider Photo-Path Int', status: 'ATIVO' },
      select: { id: true },
    });
    providerId = provider.id;
    await prisma.consent.create({
      data: {
        personId: providerId,
        purpose: 'SERVICE_OFFERING',
        termVersion: 'v1.0',
        termContentHash: 'x',
      },
    });

    const other = await prisma.person.create({
      data: { fullName: 'Other Person Photo-Path Int', status: 'ATIVO' },
      select: { id: true },
    });
    otherPersonId = other.id;

    mockPerson = personFixture(providerId);
  });

  afterAll(async () => {
    await prisma.service.deleteMany({
      where: { authorPersonId: { in: [providerId, otherPersonId] } },
    });
    await prisma.consent.deleteMany({ where: { personId: providerId } });
    await prisma.person.deleteMany({ where: { id: { in: [providerId, otherPersonId] } } });
  });

  it('AC-F3-2 / MN-F3: path de outro person.id → VALIDATION, zero serviços criados', async () => {
    mockPerson = personFixture(providerId);
    const foreignPath = `${otherPersonId}/${randomUUID()}.jpg`;

    const result = await createServiceDraft({
      title: 'Rascunho com foto de terceiro',
      photoStoragePaths: [foreignPath],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');

    const count = await prisma.service.count({
      where: { authorPersonId: providerId, title: 'Rascunho com foto de terceiro' },
    });
    expect(count).toBe(0);
  });

  it('AC-F3-3 / MN-F3: path malformado (../) → VALIDATION, zero serviços criados', async () => {
    mockPerson = personFixture(providerId);
    const malformedPath = `${providerId}/../${randomUUID()}.jpg`;

    const result = await createServiceDraft({
      title: 'Rascunho com path malformado',
      photoStoragePaths: [malformedPath],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');

    const count = await prisma.service.count({
      where: { authorPersonId: providerId, title: 'Rascunho com path malformado' },
    });
    expect(count).toBe(0);
  });

  it('AC-F3-1: path próprio válido → ok, linha ServicePhoto criada', async () => {
    mockPerson = personFixture(providerId);
    const ownPath = `${providerId}/${randomUUID()}.jpg`;

    const result = await createServiceDraft({
      title: 'Rascunho com foto própria',
      photoStoragePaths: [ownPath],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const photo = await prisma.servicePhoto.findFirst({
      where: { serviceId: result.data.serviceId, storagePath: ownPath },
      select: { id: true },
    });
    expect(photo).not.toBeNull();
  });
});
