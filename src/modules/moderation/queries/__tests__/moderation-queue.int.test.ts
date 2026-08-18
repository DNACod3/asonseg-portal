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

  // C1 (PR#294 rodada 2) — achado A2 sobrevivia fora do kind `CV`: uma linha
  // do fixture semeada com `kind: JOB`/`SERVICE`/`CANDIDATE_PROFILE` (como as
  // duas linhas acima já fazem, artefato pré-USP-020/029) fazia
  // `moderation-queue.tsx` concluir que havia reader real para ela — o painel
  // abria, o reader real nunca achava o `id` (que é do fixture, não de
  // `jobs`/`services`/`candidate_profiles`), e "Aprovar" travava para sempre.
  // `viewModerationQueue` normaliza: nenhuma linha do fixture pode sair com
  // `contentKind` igual a um dos 3 kinds com fonte própria — vira `CV`.
  it('C1: linha do fixture com kind=JOB/SERVICE/CANDIDATE_PROFILE nunca sai da fila com esse kind (evita o dead-end de Aprovar)', async () => {
    const jobLike = await seed({
      kind: ContentKind.JOB,
      status: PrismaContentStatus.IN_MODERATION,
      author: OTHER,
      submittedAt: new Date('2026-06-04T09:00:00Z'),
    });
    const serviceLike = await seed({
      kind: ContentKind.SERVICE,
      status: PrismaContentStatus.IN_MODERATION,
      author: OTHER,
      submittedAt: new Date('2026-06-05T09:00:00Z'),
    });
    const candidateLike = await seed({
      kind: ContentKind.CANDIDATE_PROFILE,
      status: PrismaContentStatus.IN_MODERATION,
      author: OTHER,
      submittedAt: new Date('2026-06-06T09:00:00Z'),
    });

    const queue = await viewModerationQueue({ viewerPersonId: VIEWER });
    const ours = queue.filter((q) => [jobLike, serviceLike, candidateLike].includes(q.contentId));

    expect(ours).toHaveLength(3);
    for (const item of ours) {
      expect(item.contentKind).toBe(ContentKind.CV);
    }
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

// USP-056/MOD-1 — perfis de candidato REAIS (`candidate_profiles`) na fila (E-001/P-005).
describe.skipIf(!hasDb)('USP-056 MOD-1 — fila inclui perfis de candidato reais', () => {
  const createdPersonIds: string[] = [];

  beforeAll(async () => {
    await prisma.person.upsert({
      where: { id: VIEWER },
      update: {},
      create: { id: VIEWER, fullName: 'Viewer Perfil Int', status: 'ATIVO' },
    });
  });

  afterEach(async () => {
    if (createdPersonIds.length > 0) {
      await prisma.candidateProfile.deleteMany({ where: { personId: { in: createdPersonIds } } });
      await prisma.person.deleteMany({ where: { id: { in: createdPersonIds } } });
      createdPersonIds.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.candidateProfile.deleteMany({ where: { personId: VIEWER } });
  });

  it('[MOD1-01] perfil IN_MODERATION real aparece como CANDIDATE_PROFILE com contentId=personId', async () => {
    const author = await prisma.person.create({
      data: { fullName: 'Autor Perfil Real', status: 'ATIVO' },
      select: { id: true },
    });
    createdPersonIds.push(author.id);
    await prisma.candidateProfile.create({
      data: {
        personId: author.id,
        headline: 'Auxiliar Administrativo Int',
        publicationStatus: PrismaContentStatus.IN_MODERATION,
      },
    });

    const queue = await viewModerationQueue({ viewerPersonId: VIEWER });
    const item = queue.find((q) => q.contentId === author.id);
    expect(item).toBeDefined();
    expect(item?.contentKind).toBe('CANDIDATE_PROFILE');
    expect(item?.title).toBe('Auxiliar Administrativo Int');
  });

  it('[USP056-MN-01/P-005] perfil cujo personId == viewer não aparece na fila', async () => {
    await prisma.candidateProfile.create({
      data: {
        personId: VIEWER,
        headline: 'Perfil do próprio viewer',
        publicationStatus: PrismaContentStatus.IN_MODERATION,
      },
    });

    const queue = await viewModerationQueue({ viewerPersonId: VIEWER });
    expect(queue.find((q) => q.contentId === VIEWER)).toBeUndefined();
  });
});
