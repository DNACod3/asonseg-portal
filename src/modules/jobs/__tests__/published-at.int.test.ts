import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

/**
 * Testes de integração de `PrismaJobStatusRepository.updateStatus` — grava
 * `published_at` na 1ª ativação e o preserva em re-aprovações (USP-023 / T1 /
 * E-005 / P-001 / D-006 — anti-manipulação de ranking via "edição cosmética +
 * re-moderação"). Exercita via `transitionContent` (contrato real de produção:
 * o container resolve `PrismaJobStatusRepository` para `ContentKind.JOB`).
 * Requer Postgres local (`supabase start`).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { transitionContent, ContentKind, ContentStatus } = await import('@/modules/moderation');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11444777000230';
const ACTOR = '00000000-0000-0000-0000-0000000000bb';

skipIfNoDb('PrismaJobStatusRepository.updateStatus — published_at (USP-023 / T1)', () => {
  let companyId = '';
  let authorId = '';

  async function cleanup() {
    const stale = await prisma.company.findUnique({ where: { cnpj: CNPJ }, select: { id: true } });
    if (stale) {
      await prisma.job.deleteMany({ where: { companyId: stale.id } });
      await prisma.company.delete({ where: { id: stale.id } });
    }
  }

  beforeAll(async () => {
    await cleanup();
    const author = await prisma.person.create({
      data: { fullName: 'Autor Published-At Int', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;
  });

  beforeEach(async () => {
    await prisma.job.deleteMany({ where: { company: { cnpj: CNPJ } } });
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Published-At Int Ltda',
        nomeFantasia: 'Published-At Int',
        setor: 'Comércio',
        createdBy: authorId,
      },
      select: { id: true },
    });
    companyId = company.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: authorId } });
  });

  async function createJob(status: 'IN_MODERATION' | 'DRAFT', publishedAt: Date | null = null) {
    return prisma.job.create({
      data: {
        companyId,
        authorPersonId: authorId,
        title: 'Vaga Published-At Int',
        status,
        publishedAt,
      },
      select: { id: true },
    });
  }

  it('1ª ativação (IN_MODERATION→ACTIVE) grava published_at = now()', async () => {
    const job = await createJob('IN_MODERATION');

    const res = await transitionContent({
      contentKind: ContentKind.JOB,
      contentId: job.id,
      to: ContentStatus.ACTIVE,
      trigger: 'MODERATOR_ACTION',
      actorPersonId: ACTOR,
    });

    expect(res.ok).toBe(true);
    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { publishedAt: true, status: true } });
    expect(row?.status).toBe('ACTIVE');
    expect(row?.publishedAt).not.toBeNull();
  });

  it('re-aprovação (edição→DRAFT→IN_MODERATION→ACTIVE) preserva o published_at original (D-006)', async () => {
    const original = new Date('2026-01-01T12:00:00.000Z');
    const job = await createJob('IN_MODERATION', original);
    // Fixture da vaga já ativada antes (publishedAt gravado na 1ª ativação).
    await prisma.job.update({ where: { id: job.id }, data: { publishedAt: original } });

    // Simula o ciclo edit→submit (fora do escopo deste teste — T6): volta a IN_MODERATION.
    await prisma.job.update({ where: { id: job.id }, data: { status: 'IN_MODERATION' } });

    const res = await transitionContent({
      contentKind: ContentKind.JOB,
      contentId: job.id,
      to: ContentStatus.ACTIVE,
      trigger: 'MODERATOR_ACTION',
      actorPersonId: ACTOR,
    });

    expect(res.ok).toBe(true);
    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { publishedAt: true } });
    expect(row?.publishedAt?.toISOString()).toBe(original.toISOString());
  });

  it('concorrência: duas ativações simultâneas — só uma casa (affected===1), a outra INVALID_TRANSITION', async () => {
    const job = await createJob('IN_MODERATION');

    const [a, b] = await Promise.all([
      transitionContent({
        contentKind: ContentKind.JOB,
        contentId: job.id,
        to: ContentStatus.ACTIVE,
        trigger: 'MODERATOR_ACTION',
        actorPersonId: ACTOR,
      }),
      transitionContent({
        contentKind: ContentKind.JOB,
        contentId: job.id,
        to: ContentStatus.ACTIVE,
        trigger: 'MODERATOR_ACTION',
        actorPersonId: ACTOR,
      }),
    ]);

    const oks = [a, b].filter((r) => r.ok).length;
    const invalids = [a, b].filter((r) => !r.ok && r.error.code === 'INVALID_TRANSITION').length;
    expect(oks).toBe(1);
    expect(invalids).toBe(1);

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true, publishedAt: true } });
    expect(row?.status).toBe('ACTIVE');
    expect(row?.publishedAt).not.toBeNull();
  });
});
