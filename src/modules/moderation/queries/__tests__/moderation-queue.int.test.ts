// Fila do coordenador (#123) — E-001 (ordem por data) e P-005 (autor ≠ moderador).
// Requer Postgres local. Degrada com graça sem banco.

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ContentStatus as PrismaContentStatus } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { ContentKind, viewModerationQueue } from '@/modules/moderation';

const hasDb = Boolean(process.env.DATABASE_URL);
const VIEWER = '00000000-0000-0000-0000-0000000000c1';
const OTHER = '00000000-0000-0000-0000-0000000000c2';
const TAG = 'queue-int';

async function seed(opts: {
  kind: ContentKind;
  status: PrismaContentStatus;
  author: string;
  submittedAt: Date;
}): Promise<string> {
  const id = randomUUID();
  await prisma.moderationFixtureContent.create({
    data: {
      id,
      kind: opts.kind,
      status: opts.status,
      title: TAG,
      authorPersonId: opts.author,
      submittedAt: opts.submittedAt,
    },
  });
  return id;
}

describe.skipIf(!hasDb)('USP-016 #123 — viewModerationQueue (integração)', () => {
  afterEach(async () => {
    await prisma.moderationFixtureContent.deleteMany({ where: { title: TAG } });
  });

  it('E-001: lista só IN_MODERATION, ordenado por submittedAt ASC', async () => {
    const older = await seed({
      kind: ContentKind.JOB,
      status: PrismaContentStatus.IN_MODERATION,
      author: OTHER,
      submittedAt: new Date('2026-06-01T09:00:00Z'),
    });
    const newer = await seed({
      kind: ContentKind.SERVICE,
      status: PrismaContentStatus.IN_MODERATION,
      author: OTHER,
      submittedAt: new Date('2026-06-03T09:00:00Z'),
    });
    // Não-IN_MODERATION não entra:
    await seed({
      kind: ContentKind.JOB,
      status: PrismaContentStatus.ACTIVE,
      author: OTHER,
      submittedAt: new Date('2026-06-02T09:00:00Z'),
    });

    const queue = await viewModerationQueue({ viewerPersonId: VIEWER });
    const ours = queue.filter((q) => q.title === TAG);
    expect(ours.map((q) => q.contentId)).toEqual([older, newer]); // mais antigo primeiro
    expect(ours.every((q) => q.title === TAG)).toBe(true);
  });

  it('P-005: exclui itens cujo autor é o próprio moderador', async () => {
    await seed({
      kind: ContentKind.JOB,
      status: PrismaContentStatus.IN_MODERATION,
      author: VIEWER, // autor == viewer → não deve aparecer
      submittedAt: new Date('2026-06-01T09:00:00Z'),
    });
    const visible = await seed({
      kind: ContentKind.CV,
      status: PrismaContentStatus.IN_MODERATION,
      author: OTHER,
      submittedAt: new Date('2026-06-02T09:00:00Z'),
    });

    const queue = await viewModerationQueue({ viewerPersonId: VIEWER });
    const ours = queue.filter((q) => q.title === TAG);
    expect(ours.map((q) => q.contentId)).toEqual([visible]);
  });
});

// USP-017 — vagas REAIS (model `jobs`) na fila com flag de verificação (E-001).
describe.skipIf(!hasDb)('USP-017 #157 — fila popula companyUnverified de vagas reais', () => {
  const JOB_CNPJ = '11444777000244';
  const createdPersonIds: string[] = [];

  afterEach(async () => {
    const company = await prisma.company.findUnique({ where: { cnpj: JOB_CNPJ }, select: { id: true } });
    if (company) {
      await prisma.job.deleteMany({ where: { companyId: company.id } });
      await prisma.personCompanyGrant.deleteMany({ where: { companyId: company.id } });
      await prisma.company.delete({ where: { id: company.id } });
    }
    if (createdPersonIds.length > 0) {
      await prisma.person.deleteMany({ where: { id: { in: createdPersonIds } } });
      createdPersonIds.length = 0;
    }
  });

  it('E-001: vaga real IN_MODERATION aparece com companyUnverified=true e companyId', async () => {
    const author = await prisma.person.create({
      data: { fullName: 'Autor Vaga Real', status: 'ATIVO' },
      select: { id: true },
    });
    createdPersonIds.push(author.id);
    const company = await prisma.company.create({
      data: {
        cnpj: JOB_CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Vaga Real Ltda',
        nomeFantasia: 'Vaga Real',
        setor: 'Comércio',
        isVerified: false,
        createdBy: author.id,
      },
      select: { id: true },
    });
    const job = await prisma.job.create({
      data: {
        companyId: company.id,
        authorPersonId: author.id,
        title: 'Vaga Real Int',
        status: PrismaContentStatus.IN_MODERATION,
      },
      select: { id: true },
    });

    const queue = await viewModerationQueue({ viewerPersonId: VIEWER });
    const item = queue.find((q) => q.contentId === job.id);
    expect(item).toBeDefined();
    expect(item?.companyUnverified).toBe(true);
    expect(item?.companyId).toBe(company.id);
  });
});

// USP-029/T029-4 — serviços REAIS (model `services`) na fila, sem companyUnverified/companyId.
describe.skipIf(!hasDb)('USP-029/T029-4 — fila inclui serviços reais', () => {
  const createdPersonIds: string[] = [];
  const createdServiceIds: string[] = [];

  // `Service.authorPersonId` tem FK real p/ `persons` (ao contrário do fixture,
  // sem constraint) — o viewer precisa existir como Pessoa para o teste P-005.
  beforeAll(async () => {
    await prisma.person.upsert({
      where: { id: VIEWER },
      update: {},
      create: { id: VIEWER, fullName: 'Viewer Fixture Int', status: 'ATIVO' },
    });
  });

  afterEach(async () => {
    if (createdServiceIds.length > 0) {
      await prisma.service.deleteMany({ where: { id: { in: createdServiceIds } } });
      createdServiceIds.length = 0;
    }
    if (createdPersonIds.length > 0) {
      await prisma.person.deleteMany({ where: { id: { in: createdPersonIds } } });
      createdPersonIds.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.service.deleteMany({ where: { authorPersonId: VIEWER } });
  });

  it('serviço IN_MODERATION real aparece na fila sem companyUnverified/companyId', async () => {
    const author = await prisma.person.create({
      data: { fullName: 'Autor Serviço Real', status: 'ATIVO' },
      select: { id: true },
    });
    createdPersonIds.push(author.id);
    const service = await prisma.service.create({
      data: {
        authorPersonId: author.id,
        title: 'Serviço Real Int',
        status: PrismaContentStatus.IN_MODERATION,
      },
      select: { id: true },
    });
    createdServiceIds.push(service.id);

    const queue = await viewModerationQueue({ viewerPersonId: VIEWER });
    const item = queue.find((q) => q.contentId === service.id);
    expect(item).toBeDefined();
    expect(item?.contentKind).toBe('SERVICE');
    expect(item?.companyUnverified).toBeUndefined();
    expect(item?.companyId).toBeUndefined();
  });

  it('P-005: autor do serviço == viewer não aparece na fila', async () => {
    const service = await prisma.service.create({
      data: {
        authorPersonId: VIEWER,
        title: 'Serviço Próprio Int',
        status: PrismaContentStatus.IN_MODERATION,
      },
      select: { id: true },
    });
    createdServiceIds.push(service.id);

    const queue = await viewModerationQueue({ viewerPersonId: VIEWER });
    expect(queue.find((q) => q.contentId === service.id)).toBeUndefined();
  });
});
