// Integração da máquina de estados `transitionContent` (#122) — AC5/AC6/P-003/P-006/R3.
// Requer Postgres local (`supabase start` + `.env.local`). Degrada com graça sem banco.
//
// Garantias verificadas contra o DB real:
//  - transição válida grava status + audit log na MESMA transação (withAudit) e dispara ports;
//  - transição não declarada retorna INVALID_TRANSITION sem tocar status nem audit;
//  - devolver/rejeitar sem motivo significativo retorna JUSTIFICATION_REQUIRED;
//  - concorrência otimista: 2ª decisão (status já mudou no DB) falha e faz rollback do audit.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentStatus as PrismaContentStatus } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { container } from '@/shared/container';
import {
  transitionContent,
  ContentKind,
  ContentStatus,
  CONTENT_STATUS_REPOSITORY_TOKEN,
  MODERATION_NOTIFICATION_TOKEN,
  CACHE_INVALIDATION_TOKEN,
  COMPANY_VERIFY_HOOK_TOKEN,
  PrismaModerationContentRepository,
  type ContentStatusRepository,
  type ModerationNotificationPort,
  type CacheInvalidationPort,
  type CompanyVerifyHookPort,
} from '@/modules/moderation';

const hasDb = Boolean(process.env.DATABASE_URL);
const ACTOR = '00000000-0000-0000-0000-0000000000aa';

async function seedContent(kind: ContentKind, status: ContentStatus): Promise<string> {
  const id = randomUUID();
  await prisma.moderationFixtureContent.create({
    data: {
      id,
      kind,
      status: status as unknown as PrismaContentStatus,
      title: `fixture-${kind}`,
      authorPersonId: ACTOR,
    },
  });
  return id;
}

const statusOf = async (id: string): Promise<string | undefined> =>
  (await prisma.moderationFixtureContent.findUnique({ where: { id }, select: { status: true } }))?.status;

const auditRows = (entityId: string) =>
  prisma.auditLog.findMany({ where: { entityId }, select: { action: true, justification: true, before: true, after: true } });

describe.skipIf(!hasDb)('USP-016 #122 — transitionContent (integração)', () => {
  let notifySpy: ReturnType<typeof vi.fn>;
  let cacheSpy: ReturnType<typeof vi.fn>;
  let hookSpy: ReturnType<typeof vi.fn>;
  let rejectHookSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Side effects viram spies (evita next/cache fora de request e permite asserções).
    // O ContentStatusRepository permanece o adapter Prisma real contra o DB.
    notifySpy = vi.fn().mockResolvedValue(undefined);
    cacheSpy = vi.fn().mockResolvedValue(undefined);
    hookSpy = vi.fn().mockResolvedValue(undefined);
    rejectHookSpy = vi.fn().mockResolvedValue(undefined);
    container.register(CONTENT_STATUS_REPOSITORY_TOKEN, () => new PrismaModerationContentRepository());
    container.register(
      MODERATION_NOTIFICATION_TOKEN,
      () => ({ sendModerationDecision: notifySpy }) as unknown as ModerationNotificationPort,
    );
    container.register(
      CACHE_INVALIDATION_TOKEN,
      () => ({ revalidateForContent: cacheSpy }) as unknown as CacheInvalidationPort,
    );
    container.register(
      COMPANY_VERIFY_HOOK_TOKEN,
      () =>
        ({ onContentActivated: hookSpy, onContentRejected: rejectHookSpy }) as unknown as CompanyVerifyHookPort,
    );
  });

  afterEach(async () => {
    await prisma.moderationFixtureContent.deleteMany({ where: { authorPersonId: ACTOR } });
  });

  it('E-002/AC5/P-006: IN_MODERATION→ACTIVE grava status + audit CONTENT_APPROVED na mesma tx e dispara ports', async () => {
    const id = await seedContent(ContentKind.JOB, ContentStatus.IN_MODERATION);

    const res = await transitionContent({
      contentKind: ContentKind.JOB,
      contentId: id,
      to: ContentStatus.ACTIVE,
      trigger: 'MODERATOR_ACTION',
      actorPersonId: ACTOR,
    });

    expect(res).toMatchObject({ ok: true, data: { from: ContentStatus.IN_MODERATION, to: ContentStatus.ACTIVE } });
    expect(await statusOf(id)).toBe('ACTIVE');

    const rows = await auditRows(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'CONTENT_APPROVED', after: { status: 'ACTIVE' } });

    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(cacheSpy).toHaveBeenCalledTimes(1);
    expect(hookSpy).toHaveBeenCalledTimes(1); // ACTIVE → hook de Empresa
  });

  it('E-004/L-003: rejeitar com motivo grava CONTENT_REJECTED + justificativa no audit', async () => {
    const id = await seedContent(ContentKind.SERVICE, ContentStatus.IN_MODERATION);
    const motivo = 'Serviço não compatível com as diretrizes do portal';

    const res = await transitionContent({
      contentKind: ContentKind.SERVICE,
      contentId: id,
      to: ContentStatus.REJECTED,
      trigger: 'MODERATOR_ACTION',
      justification: motivo,
      actorPersonId: ACTOR,
    });

    expect(res.ok).toBe(true);
    expect(await statusOf(id)).toBe('REJECTED');
    const rows = await auditRows(id);
    expect(rows[0]).toMatchObject({ action: 'CONTENT_REJECTED', justification: motivo });
    expect(hookSpy).not.toHaveBeenCalled(); // verificação só em ACTIVE
    expect(rejectHookSpy).toHaveBeenCalledTimes(1); // contador de rejeição em REJECTED
  });

  it('AC6: transição não declarada retorna INVALID_TRANSITION sem alterar status nem audit', async () => {
    const id = await seedContent(ContentKind.JOB, ContentStatus.REJECTED);

    const res = await transitionContent({
      contentKind: ContentKind.JOB,
      contentId: id,
      to: ContentStatus.ACTIVE,
      trigger: 'MODERATOR_ACTION',
      actorPersonId: ACTOR,
    });

    expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
    expect(await statusOf(id)).toBe('REJECTED');
    expect(await auditRows(id)).toHaveLength(0);
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('P-003: devolver com motivo insignificante retorna JUSTIFICATION_REQUIRED sem efeitos', async () => {
    const id = await seedContent(ContentKind.CV, ContentStatus.IN_MODERATION);

    const res = await transitionContent({
      contentKind: ContentKind.CV,
      contentId: id,
      to: ContentStatus.AWAITING_ADJUSTMENTS,
      trigger: 'MODERATOR_ACTION',
      justification: 'x',
      actorPersonId: ACTOR,
    });

    expect(res).toMatchObject({ ok: false, error: { code: 'JUSTIFICATION_REQUIRED' } });
    expect(await statusOf(id)).toBe('IN_MODERATION');
    expect(await auditRows(id)).toHaveLength(0);
  });

  it('R3/concorrência: 2ª decisão (status já mudou no DB) falha e faz rollback do audit', async () => {
    // DB já está ACTIVE, mas o repo informa IN_MODERATION (stale) — simula a corrida:
    // valida ok, mas o UPDATE ... WHERE status = IN_MODERATION casa 0 linhas → conflito.
    const id = await seedContent(ContentKind.JOB, ContentStatus.ACTIVE);
    const realRepo = new PrismaModerationContentRepository();
    const staleRepo: ContentStatusRepository = {
      loadStatus: async () => ContentStatus.IN_MODERATION,
      updateStatus: (tx, kind, contentId, from, to) => realRepo.updateStatus(tx, kind, contentId, from, to),
    };
    container.register(CONTENT_STATUS_REPOSITORY_TOKEN, () => staleRepo);

    const res = await transitionContent({
      contentKind: ContentKind.JOB,
      contentId: id,
      to: ContentStatus.ACTIVE,
      trigger: 'MODERATOR_ACTION',
      actorPersonId: ACTOR,
    });

    expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
    expect(await statusOf(id)).toBe('ACTIVE'); // inalterado
    expect(await auditRows(id)).toHaveLength(0); // audit revertido junto
  });
});
