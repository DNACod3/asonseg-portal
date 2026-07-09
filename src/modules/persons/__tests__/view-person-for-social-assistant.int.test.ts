import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import type { CurrentPerson } from '@/modules/identity';
import { ContentStatus } from '@/modules/moderation';
import type { ConsolidatedExternalDimensions } from '../views/view-person-for-social-assistant';

/**
 * Testes de integração do assembler `viewPersonForSocialAssistant` (USP-039 /
 * T6) — fonte única de anonimização do painel consolidado. Requer Postgres
 * local (`supabase start`).
 *
 * Mocks: `next/headers` (IP/UA, exigido pelo `getSocioeconomicRecord` reusado)
 * e `@/modules/identity` (operador autenticado — o gate interno do
 * `getSocioeconomicRecord` é independente do parâmetro `viewer` deste
 * assembler; o mock sincroniza ambos, como faria a sessão real). Espia
 * `getSocioeconomicRecord` (mantendo o comportamento real) para provar B1 do
 * SOC-039-MN-01: para não-AS/BOARD, a função **não é chamada**.
 * Real: Prisma/Postgres — leitura da ficha + `viewPersonForStaff` + audit_log.
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.11', 'user-agent': 'vitest/int' })),
}));

const AS_ID = 'aaaaaaaa-3000-4000-8000-000000000001';
const AS_SUPA = 'aaaaaaaa-3000-4000-8000-000000000002';

let mockOperator: CurrentPerson | null = {
  id: AS_ID,
  supabaseUserId: AS_SUPA,
  fullName: 'Assistente Social Teste',
  status: 'ATIVO',
  primeiroAcesso: false,
  roles: ['SOCIAL_ASSISTANT'],
  phone: null,
  fullAddress: null,
};

vi.mock('@/modules/identity', () => ({
  getCurrentPerson: vi.fn(async () => mockOperator),
}));

const getSocioeconomicRecordSpy = vi.fn();
vi.mock('../queries/get-socioeconomic-record', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../queries/get-socioeconomic-record')>();
  return {
    ...actual,
    getSocioeconomicRecord: async (personId: string) => {
      getSocioeconomicRecordSpy(personId);
      return actual.getSocioeconomicRecord(personId);
    },
  };
});

const { prisma } = await import('@/shared/lib/prisma');
const { viewPersonForSocialAssistant } = await import('../views/view-person-for-social-assistant');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const EMPTY_DIMENSIONS: ConsolidatedExternalDimensions = {
  applications: [],
  referrals: [],
  servicesOffered: [],
  serviceInterests: [],
  companyGrants: [],
};

const FIXTURE_DIMENSIONS: ConsolidatedExternalDimensions = {
  applications: [
    {
      id: 'app-1',
      jobId: 'job-1',
      jobTitle: 'Vaga Fixture',
      companyName: 'Empresa Fixture',
      appliedAt: new Date('2026-07-01T10:00:00Z'),
      cancelledAt: null,
      active: true,
      viaEncaminhamento: false,
    },
  ],
  referrals: [
    {
      id: 'ref-1',
      jobId: 'job-1',
      jobTitle: 'Vaga Fixture',
      companyName: 'Empresa Fixture',
      referrerName: 'Encaminhador Fixture',
      justification: null,
      result: null,
      resultObservation: null,
      resultRegisteredAt: null,
      createdAt: new Date('2026-07-01T10:00:00Z'),
    },
  ],
  servicesOffered: [
    { id: 'svc-1', title: 'Serviço Fixture', status: ContentStatus.ACTIVE, publishedAt: new Date(), lastStatusChangeAt: new Date() },
  ],
  serviceInterests: [
    {
      id: 'int-1',
      serviceId: 'svc-2',
      serviceTitle: 'Serviço Interesse Fixture',
      providerName: 'Prestador Fixture',
      interestedAt: new Date('2026-07-01T10:00:00Z'),
      cancelledAt: null,
      active: true,
    },
  ],
  companyGrants: [
    {
      grantId: 'grant-1',
      companyId: 'company-1',
      companyName: 'Empresa Grant Fixture',
      grantType: 'RESPONSIBLE',
      status: 'ACTIVE',
      grantedAt: new Date('2026-07-01T10:00:00Z'),
      acceptedAt: new Date('2026-07-01T10:00:00Z'),
    },
  ],
};

skipIfNoDb('viewPersonForSocialAssistant — integração', () => {
  const createdIds: string[] = [];

  function asOperator(roles: string[]) {
    mockOperator = {
      id: AS_ID,
      supabaseUserId: AS_SUPA,
      fullName: 'Assistente Social Teste',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles,
      phone: null,
      fullAddress: null,
    };
  }

  async function makePersonWithRecord(): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.person.create({ data: { id, fullName: 'Pessoa Consolidado Alvo', status: 'ATIVO' } });
    await prisma.socioeconomicRecord.create({
      data: {
        personId: id,
        incomeBracket: 'FROM_2_TO_3_MW',
        socialBenefit: 'Auxílio Consolidado Sensor',
        housingSituation: 'RENTED',
        familyComposition: '4 pessoas consolidado sensor',
        updatedByPersonId: AS_ID,
      },
    });
    createdIds.push(id);
    return id;
  }

  afterEach(async () => {
    for (const id of createdIds) {
      await prisma.socioeconomicRecord.deleteMany({ where: { personId: id } });
      await prisma.person.deleteMany({ where: { id } });
    }
    createdIds.length = 0;
    asOperator(['SOCIAL_ASSISTANT']);
    getSocioeconomicRecordSpy.mockClear();
  });

  it('AS: painel completo com todas as dimensões + ficha + 1 SENSITIVE_FIELD_VIEWED', async () => {
    const targetId = await makePersonWithRecord();

    const view = await viewPersonForSocialAssistant(targetId, { roles: ['SOCIAL_ASSISTANT'] }, FIXTURE_DIMENSIONS);
    expect(view).not.toBeNull();
    expect(view?.ficha).toMatchObject({
      incomeBracket: 'FROM_2_TO_3_MW',
      socialBenefit: 'Auxílio Consolidado Sensor',
      housingSituation: 'RENTED',
      familyComposition: '4 pessoas consolidado sensor',
    });
    expect(view?.applications).toEqual(FIXTURE_DIMENSIONS.applications);
    expect(view?.referrals).toEqual(FIXTURE_DIMENSIONS.referrals);
    expect(view?.servicesOffered).toEqual(FIXTURE_DIMENSIONS.servicesOffered);
    expect(view?.serviceInterests).toEqual(FIXTURE_DIMENSIONS.serviceInterests);
    expect(view?.companyGrants).toEqual(FIXTURE_DIMENSIONS.companyGrants);
    expect(getSocioeconomicRecordSpy).toHaveBeenCalledTimes(1);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'SENSITIVE_FIELD_VIEWED', entityId: targetId, entityType: 'person' },
    });
    expect(audit).not.toBeNull();
  });

  it('BOARD: também recebe a ficha (Assumption #4)', async () => {
    const targetId = await makePersonWithRecord();
    asOperator(['BOARD']);

    const view = await viewPersonForSocialAssistant(targetId, { roles: ['BOARD'] }, EMPTY_DIMENSIONS);
    expect(view?.ficha?.incomeBracket).toBe('FROM_2_TO_3_MW');
  });

  it('SOC-039-MN-01: COORDINATOR não recebe a ficha — getSocioeconomicRecord NÃO é chamado, sem valor sensível no payload, sem audit', async () => {
    const targetId = await makePersonWithRecord();
    asOperator(['COORDINATOR']);

    const view = await viewPersonForSocialAssistant(targetId, { roles: ['COORDINATOR'] }, FIXTURE_DIMENSIONS);

    expect(view).not.toBeNull();
    expect(view?.ficha).toBeNull();
    // B1: a função de leitura da ficha nunca é chamada para coordenador.
    expect(getSocioeconomicRecordSpy).not.toHaveBeenCalled();
    // Sensor: nenhum valor sensível da ficha aparece no payload serializado.
    const serialized = JSON.stringify(view);
    expect(serialized).not.toMatch(/FROM_2_TO_3_MW|Auxílio Consolidado Sensor|RENTED|4 pessoas consolidado sensor/);
    // Nenhuma leitura sensível foi registrada (nada sensível foi de fato exposto).
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'SENSITIVE_FIELD_VIEWED', entityId: targetId, entityType: 'person' },
    });
    expect(audit).toBeNull();
    // As demais dimensões operacionais continuam presentes (coordenador vê o operacional).
    expect(view?.applications).toEqual(FIXTURE_DIMENSIONS.applications);
    expect(view?.referrals).toEqual(FIXTURE_DIMENSIONS.referrals);
    expect(view?.servicesOffered).toEqual(FIXTURE_DIMENSIONS.servicesOffered);
    expect(view?.serviceInterests).toEqual(FIXTURE_DIMENSIONS.serviceInterests);
    expect(view?.companyGrants).toEqual(FIXTURE_DIMENSIONS.companyGrants);
  });

  it('SOC-039-MN-02: VOLUNTEER recebe null — nenhuma dimensão buscada/serializada', async () => {
    const targetId = await makePersonWithRecord();
    asOperator(['VOLUNTEER']);

    const view = await viewPersonForSocialAssistant(targetId, { roles: ['VOLUNTEER'] }, FIXTURE_DIMENSIONS);
    expect(view).toBeNull();
    expect(getSocioeconomicRecordSpy).not.toHaveBeenCalled();
  });

  it('Pessoa inexistente (viewer AS) → null', async () => {
    const view = await viewPersonForSocialAssistant(
      '00000000-0000-0000-0000-000000000000',
      { roles: ['SOCIAL_ASSISTANT'] },
      EMPTY_DIMENSIONS,
    );
    expect(view).toBeNull();
  });

  it('Pessoa sem ficha ainda (AS): view.ficha=null, sem erro, sem SENSITIVE_FIELD_VIEWED', async () => {
    const id = crypto.randomUUID();
    await prisma.person.create({ data: { id, fullName: 'Pessoa Consolidado Sem Ficha', status: 'ATIVO' } });
    createdIds.push(id);

    const view = await viewPersonForSocialAssistant(id, { roles: ['SOCIAL_ASSISTANT'] }, EMPTY_DIMENSIONS);
    expect(view?.ficha).toBeNull();
    expect(getSocioeconomicRecordSpy).toHaveBeenCalledTimes(1);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'SENSITIVE_FIELD_VIEWED', entityId: id, entityType: 'person' },
    });
    expect(audit).toBeNull();
  });
});
