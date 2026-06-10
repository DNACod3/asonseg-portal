// Fila do coordenador (#123) — E-001 (ordem por data) e P-005 (autor ≠ moderador).
// Requer Postgres local. Degrada com graça sem banco.

import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
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
