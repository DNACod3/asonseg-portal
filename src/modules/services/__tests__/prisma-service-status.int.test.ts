import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

/**
 * Testes de integração de `PrismaServiceStatusRepository` (USP-029 / T029-3) —
 * load/update de `services.status` com concorrência otimista e gravação de
 * `published_at` na 1ª ativação. Exercita via `transitionContent` (contrato real
 * de produção: o container resolve `PrismaServiceStatusRepository` para
 * `ContentKind.SERVICE`). Espelha `jobs/__tests__/published-at.int.test.ts`.
 * Requer Postgres local (`supabase start`).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { transitionContent, ContentKind, ContentStatus } = await import('@/modules/moderation');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const ACTOR = '00000000-0000-0000-0000-0000000000cc';

skipIfNoDb('PrismaServiceStatusRepository — load/update (USP-029 / T029-3)', () => {
  let authorId = '';

  async function cleanup() {
    await prisma.service.deleteMany({ where: { authorPersonId: authorId } });
  }

  beforeAll(async () => {
    const author = await prisma.person.create({
      data: { fullName: 'Autor Service-Status Int', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;
  });

  beforeEach(async () => {
    if (authorId) await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: authorId } });
  });

  async function createService(status: 'IN_MODERATION' | 'DRAFT' | 'ACTIVE', publishedAt: Date | null = null) {
    return prisma.service.create({
      data: {
        authorPersonId: authorId,
        title: 'Serviço Status Int',
        status,
        publishedAt,
      },
      select: { id: true },
    });
  }

  it('1ª ativação (IN_MODERATION→ACTIVE) grava published_at = now()', async () => {
    const service = await createService('IN_MODERATION');

    const res = await transitionContent({
      contentKind: ContentKind.SERVICE,
      contentId: service.id,
      to: ContentStatus.ACTIVE,
      trigger: 'MODERATOR_ACTION',
      actorPersonId: ACTOR,
    });

    expect(res.ok).toBe(true);
    const row = await prisma.service.findUnique({
      where: { id: service.id },
      select: { publishedAt: true, status: true },
    });
    expect(row?.status).toBe('ACTIVE');
    expect(row?.publishedAt).not.toBeNull();
  });

  it('re-aprovação (edição→DRAFT→IN_MODERATION→ACTIVE) preserva o published_at original', async () => {
    const original = new Date('2026-01-01T12:00:00.000Z');
    const service = await createService('IN_MODERATION', original);
    await prisma.service.update({ where: { id: service.id }, data: { publishedAt: original } });

    const res = await transitionContent({
      contentKind: ContentKind.SERVICE,
      contentId: service.id,
      to: ContentStatus.ACTIVE,
      trigger: 'MODERATOR_ACTION',
      actorPersonId: ACTOR,
    });

    expect(res.ok).toBe(true);
    const row = await prisma.service.findUnique({ where: { id: service.id }, select: { publishedAt: true } });
    expect(row?.publishedAt?.toISOString()).toBe(original.toISOString());
  });

  it('concorrência: duas ativações simultâneas — só uma casa (affected===1), a outra INVALID_TRANSITION', async () => {
    const service = await createService('IN_MODERATION');

    const [a, b] = await Promise.all([
      transitionContent({
        contentKind: ContentKind.SERVICE,
        contentId: service.id,
        to: ContentStatus.ACTIVE,
        trigger: 'MODERATOR_ACTION',
        actorPersonId: ACTOR,
      }),
      transitionContent({
        contentKind: ContentKind.SERVICE,
        contentId: service.id,
        to: ContentStatus.ACTIVE,
        trigger: 'MODERATOR_ACTION',
        actorPersonId: ACTOR,
      }),
    ]);

    const oks = [a, b].filter((r) => r.ok).length;
    const invalids = [a, b].filter((r) => !r.ok && r.error.code === 'INVALID_TRANSITION').length;
    expect(oks).toBe(1);
    expect(invalids).toBe(1);

    const row = await prisma.service.findUnique({
      where: { id: service.id },
      select: { status: true, publishedAt: true },
    });
    expect(row?.status).toBe('ACTIVE');
    expect(row?.publishedAt).not.toBeNull();
  });

  it('loadStatus retorna null para serviço inexistente', async () => {
    const res = await transitionContent({
      contentKind: ContentKind.SERVICE,
      contentId: '00000000-0000-0000-0000-000000000000',
      to: ContentStatus.ACTIVE,
      trigger: 'MODERATOR_ACTION',
      actorPersonId: ACTOR,
    });
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });
});
