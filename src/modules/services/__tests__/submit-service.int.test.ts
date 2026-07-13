import { randomUUID } from 'node:crypto';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração das Server Actions createServiceDraft/submitServiceForModeration
 * (USP-029 / T029-6). Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Real: Prisma/Postgres + FSM (transitionContent via container) — submissão válida
 * → IN_MODERATION (AC-029-2), gate de autorização (papel PROVIDER + responsável
 * ativo da Empresa + consentimento SERVICE_OFFERING — SVC029-MN-02/MN-03), dedup
 * (service_dedup_alive) e concorrência otimista (ADR-0011 R3). Mocks: next/headers
 * (IP/UA), session (pessoa autenticada).
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.2', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { submitServiceForModeration } = await import('../actions/submit-service-for-moderation');
const { createServiceDraft } = await import('../actions/create-service-draft');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11444777000353';
const CATEGORY_NAME = 'Jardinagem Int Submit';

skipIfNoDb('submitServiceForModeration / createServiceDraft — integração', () => {
  let providerId = ''; // PROVIDER + consent + responsável ativo da Empresa
  let noRoleId = ''; // sem papel PROVIDER
  let noConsentId = ''; // papel PROVIDER, sem consentimento SERVICE_OFFERING
  let notResponsibleId = ''; // papel PROVIDER + consent, mas NÃO responsável da Empresa
  let companyId = '';
  let categoryId = '';
  let regionId = '';

  function personFixture(id: string, roles: string[] = ['PROVIDER']): CurrentPerson {
    return {
      id,
      supabaseUserId: '00000000-0000-0000-0000-000000000002',
      fullName: 'Prestador Int',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles,
      phone: null,
      fullAddress: null,
    };
  }

  function fullInput(overrides: Record<string, unknown> = {}) {
    return {
      title: 'Jardinagem residencial',
      categoryId,
      description: 'Poda, manutenção de grama e jardins residenciais.',
      priceMin: 80,
      priceMax: 150,
      priceUnit: 'por serviço',
      regionId,
      availabilityDescription: 'Segunda a sexta, 8h às 17h.',
      ...overrides,
    };
  }

  async function cleanupCompany() {
    const stale = await prisma.company.findUnique({ where: { cnpj: CNPJ }, select: { id: true } });
    if (stale) {
      await prisma.service.deleteMany({ where: { companyId: stale.id } });
      await prisma.personCompanyGrant.deleteMany({ where: { companyId: stale.id } });
      await prisma.company.delete({ where: { id: stale.id } });
    }
  }

  beforeAll(async () => {
    await cleanupCompany();
    const category = await prisma.serviceCategory.upsert({
      where: { name: CATEGORY_NAME },
      update: {},
      create: { name: CATEGORY_NAME },
      select: { id: true },
    });
    categoryId = category.id;
    // Defensivo: serviços órfãos de uma execução anterior interrompida (ex.: PF de
    // um providerId antigo) referenciam a mesma categoria (upsert estável) e
    // bloqueiam a FK ao limpar no afterAll.
    await prisma.service.deleteMany({ where: { categoryId } });

    const region = await prisma.region.upsert({
      where: { name: 'Centro Int Submit Service' },
      update: {},
      create: { name: 'Centro Int Submit Service', cityName: 'Florianópolis' },
      select: { id: true },
    });
    regionId = region.id;

    const provider = await prisma.person.create({
      data: { fullName: 'Provider Submit Int', status: 'ATIVO' },
      select: { id: true },
    });
    providerId = provider.id;
    await prisma.consent.create({
      data: { personId: providerId, purpose: 'SERVICE_OFFERING', termVersion: 'v1.0', termContentHash: 'x' },
    });

    const noRole = await prisma.person.create({
      data: { fullName: 'Sem Papel Submit Int', status: 'ATIVO' },
      select: { id: true },
    });
    noRoleId = noRole.id;

    const noConsent = await prisma.person.create({
      data: { fullName: 'Sem Consent Submit Int', status: 'ATIVO' },
      select: { id: true },
    });
    noConsentId = noConsent.id;

    const notResponsible = await prisma.person.create({
      data: { fullName: 'Nao Responsavel Submit Int', status: 'ATIVO' },
      select: { id: true },
    });
    notResponsibleId = notResponsible.id;
    await prisma.consent.create({
      data: {
        personId: notResponsibleId,
        purpose: 'SERVICE_OFFERING',
        termVersion: 'v1.0',
        termContentHash: 'x',
      },
    });
  });

  beforeEach(async () => {
    await cleanupCompany();
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Jardinagem Submit Ltda',
        nomeFantasia: 'Jardinagem Submit',
        setor: 'Serviços',
        createdBy: providerId,
      },
      select: { id: true },
    });
    companyId = company.id;
    await prisma.personCompanyGrant.create({
      data: {
        personId: providerId,
        companyId,
        grantType: 'RESPONSIBLE',
        grantedBy: providerId,
        status: 'ACTIVE',
      },
    });
    mockPerson = personFixture(providerId);
  });

  afterAll(async () => {
    await cleanupCompany();
    // Serviços PF (sem companyId) ficam vinculados só ao autor — cleanupCompany()
    // não os alcança.
    await prisma.service.deleteMany({
      where: { authorPersonId: { in: [providerId, noRoleId, noConsentId, notResponsibleId] } },
    });
    await prisma.consent.deleteMany({
      where: { personId: { in: [providerId, noRoleId, noConsentId, notResponsibleId] } },
    });
    await prisma.person.deleteMany({
      where: { id: { in: [providerId, noRoleId, noConsentId, notResponsibleId] } },
    });
    await prisma.serviceCategory.deleteMany({ where: { name: CATEGORY_NAME } });
    // HYG-09/HYG-11: remove a Region própria deste arquivo (a categoria já era
    // limpa) — evita poluir o select de região dos dropdowns públicos (SVC-3).
    await prisma.region.deleteMany({ where: { name: 'Centro Int Submit Service' } });
    expect(await prisma.region.count({ where: { name: 'Centro Int Submit Service' } })).toBe(0);
  });

  it('AC-029-1/AC-029-2: PF (sem companyId) → IN_MODERATION vinculado ao autor', async () => {
    const result = await submitServiceForModeration(fullInput({ title: 'Jardinagem PF' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('IN_MODERATION');

    const service = await prisma.service.findUnique({
      where: { id: result.data.serviceId },
      select: { status: true, companyId: true, authorPersonId: true },
    });
    expect(service).toMatchObject({ status: 'IN_MODERATION', companyId: null, authorPersonId: providerId });
  });

  it('AC-029-1/AC-029-2: em nome de Empresa (companyId) → IN_MODERATION vinculado à Empresa', async () => {
    const result = await submitServiceForModeration(fullInput({ title: 'Jardinagem Empresa', companyId }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const service = await prisma.service.findUnique({
      where: { id: result.data.serviceId },
      select: { status: true, companyId: true, authorPersonId: true },
    });
    expect(service).toMatchObject({ status: 'IN_MODERATION', companyId, authorPersonId: providerId });
  });

  it('SVC029-MN-01: submissão nunca persiste status ACTIVE diretamente', async () => {
    const result = await submitServiceForModeration(fullInput({ title: 'Never Active' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('IN_MODERATION');
    expect(result.data.status).not.toBe('ACTIVE');
  });

  it('grava CONTENT_SUBMITTED_TO_MODERATION (append-only) na submissão', async () => {
    const result = await submitServiceForModeration(fullInput({ title: 'Auditoria Submit' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const entry = await prisma.auditLog.findFirst({
      where: {
        action: 'CONTENT_SUBMITTED_TO_MODERATION',
        entityType: 'SERVICE',
        entityId: result.data.serviceId,
      },
      orderBy: { occurredAt: 'desc' },
      select: { after: true },
    });
    expect(entry).not.toBeNull();
    expect((entry?.after as Record<string, unknown>)?.status).toBe('IN_MODERATION');
  });

  it.each(['title', 'categoryId', 'description', 'priceUnit', 'regionId', 'availabilityDescription'])(
    'AC-029-3: campo obrigatório ausente "%s" → VALIDATION',
    async (campo) => {
      const input = fullInput();
      delete (input as Record<string, unknown>)[campo];
      const result = await submitServiceForModeration(input);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
    },
  );

  it('SVC029-MN-02: sem papel PROVIDER → FORBIDDEN, sem persistir', async () => {
    mockPerson = personFixture(noRoleId, []);
    const result = await submitServiceForModeration(fullInput({ title: 'Sem Papel' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('FORBIDDEN');

    const count = await prisma.service.count({ where: { authorPersonId: noRoleId } });
    expect(count).toBe(0);
  });

  it('consentimento SERVICE_OFFERING ausente → CONSENT_REQUIRED', async () => {
    mockPerson = personFixture(noConsentId);
    const result = await submitServiceForModeration(fullInput({ title: 'Sem Consent' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CONSENT_REQUIRED');
  });

  it('SVC029-MN-03: publicar em nome de Empresa não representada → FORBIDDEN', async () => {
    mockPerson = personFixture(notResponsibleId);
    const result = await submitServiceForModeration(fullInput({ title: 'Empresa Alheia', companyId }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('FORBIDDEN');

    const count = await prisma.service.count({ where: { companyId, authorPersonId: notResponsibleId } });
    expect(count).toBe(0);
  });

  it('AC-F3-2 / MN-F3: ramo form-direto com photoStoragePath de terceiro → VALIDATION, sem persistir', async () => {
    mockPerson = personFixture(providerId);
    const foreignPath = `${randomUUID()}/${randomUUID()}.jpg`;

    const result = await submitServiceForModeration(
      fullInput({ title: 'Submit com foto de terceiro', photoStoragePaths: [foreignPath] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');

    const count = await prisma.service.count({
      where: { authorPersonId: providerId, title: 'Submit com foto de terceiro' },
    });
    expect(count).toBe(0);
  });

  it('dedup: 2º serviço vivo idêntico (autor+categoria+título) → CONFLICT', async () => {
    const first = await submitServiceForModeration(fullInput({ title: 'Serviço Duplicado' }));
    expect(first.ok).toBe(true);

    const second = await submitServiceForModeration(fullInput({ title: 'Serviço Duplicado' }));
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('CONFLICT');
  });

  it('concorrência: submit paralelo do mesmo rascunho — 1 transição, 2ª INVALID_TRANSITION', async () => {
    const draft = await createServiceDraft({ title: 'Rascunho concorrente' });
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    const [a, b] = await Promise.all([
      submitServiceForModeration({ serviceId: draft.data.serviceId }),
      submitServiceForModeration({ serviceId: draft.data.serviceId }),
    ]);

    const oks = [a, b].filter((r) => r.ok).length;
    const invalids = [a, b].filter((r) => !r.ok && r.error.code === 'INVALID_TRANSITION').length;
    expect(oks).toBe(1);
    expect(invalids).toBe(1);

    const service = await prisma.service.findUnique({
      where: { id: draft.data.serviceId },
      select: { status: true },
    });
    expect(service?.status).toBe('IN_MODERATION');
  });

  it('recheck de ownership: submeter rascunho alheio (serviceId de outro autor) → FORBIDDEN', async () => {
    const draft = await createServiceDraft({ title: 'Rascunho de outro autor' });
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    mockPerson = personFixture(notResponsibleId);
    const result = await submitServiceForModeration({ serviceId: draft.data.serviceId });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('FORBIDDEN');
  });
});

describe.skipIf(!process.env.DATABASE_URL)('createServiceDraft — integração', () => {
  let providerId = '';

  function personFixture(id: string, roles: string[] = ['PROVIDER']): CurrentPerson {
    return {
      id,
      supabaseUserId: '00000000-0000-0000-0000-000000000003',
      fullName: 'Prestador Draft Int',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles,
      phone: null,
      fullAddress: null,
    };
  }

  beforeAll(async () => {
    const provider = await prisma.person.create({
      data: { fullName: 'Provider Draft Int', status: 'ATIVO' },
      select: { id: true },
    });
    providerId = provider.id;
    await prisma.consent.create({
      data: { personId: providerId, purpose: 'SERVICE_OFFERING', termVersion: 'v1.0', termContentHash: 'x' },
    });
    mockPerson = personFixture(providerId);
  });

  afterAll(async () => {
    await prisma.service.deleteMany({ where: { authorPersonId: providerId } });
    await prisma.consent.deleteMany({ where: { personId: providerId } });
    await prisma.person.deleteMany({ where: { id: providerId } });
  });

  it('AC-029-3: rascunho só com título → DRAFT, demais campos nulos', async () => {
    mockPerson = personFixture(providerId);
    const result = await createServiceDraft({ title: 'Rascunho só título' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('DRAFT');

    const service = await prisma.service.findUnique({
      where: { id: result.data.serviceId },
      select: { status: true, categoryId: true, description: true, companyId: true },
    });
    expect(service).toMatchObject({ status: 'DRAFT', categoryId: null, description: null, companyId: null });
  });

  it('grava SERVICE_DRAFT_SAVED no audit', async () => {
    const result = await createServiceDraft({ title: 'Rascunho Auditado' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const entry = await prisma.auditLog.findFirst({
      where: { action: 'SERVICE_DRAFT_SAVED', entityType: 'SERVICE', entityId: result.data.serviceId },
    });
    expect(entry).not.toBeNull();
  });
});
