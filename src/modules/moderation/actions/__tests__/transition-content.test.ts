// Unit da função canônica `transitionContent` (#122) — exercita a orquestração
// (carregar status → validar → exigir motivo → withAudit → side effects) com
// ports stub e `withAudit` mockado, SEM banco. O caminho com Postgres real está
// em `../../__tests__/transition-content.int.test.ts`; aqui cobrimos os ramos de
// decisão (NOT_FOUND, INVALID_TRANSITION, JUSTIFICATION_REQUIRED, conflito R3,
// soft-fail R2, mapeamento de evento e ausência de evento) de forma rápida.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// USP-041/T6: revalidateHomeIndicators() chama next/cache.revalidatePath, que
// lança fora de um request Next real ("static generation store missing").
// Vira spy aqui (mesmo motivo dos outros side effects — este é um teste
// unitário puro, sem servidor Next de verdade por trás).
const homeRevalidateSpy = vi.hoisted(() => vi.fn());
vi.mock('@/modules/reporting', () => ({
  revalidateHomeIndicators: homeRevalidateSpy,
}));

// `withAudit(event, cb, ctx)` roda o callback com tx/audit fake e devolve seu
// retorno — sem transação real. Mantém o catálogo `AuditEvent` (mapeamento real).
const auditState = vi.hoisted(() => ({
  event: undefined as string | undefined,
  ctx: undefined as unknown,
  audit: undefined as Record<string, unknown> | undefined,
}));

vi.mock('@/modules/audit', async (orig) => {
  const actual = await orig<typeof import('@/modules/audit')>();
  return {
    ...actual,
    withAudit: vi.fn(
      async (
        event: string,
        cb: (tx: unknown, audit: Record<string, unknown>) => Promise<unknown>,
        ctx: unknown,
      ) => {
        auditState.event = event;
        auditState.ctx = ctx;
        const audit: Record<string, unknown> = {};
        auditState.audit = audit;
        return cb({}, audit);
      },
    ),
  };
});

import { AuditEvent } from '@/modules/audit';
import { container } from '@/shared/container';
import {
  transitionContent,
  ContentKind,
  ContentStatus,
  CONTENT_STATUS_REPOSITORY_TOKEN,
  MODERATION_NOTIFICATION_TOKEN,
  CACHE_INVALIDATION_TOKEN,
  COMPANY_VERIFY_HOOK_TOKEN,
  type ContentStatusRepository,
  type ModerationNotificationPort,
  type CacheInvalidationPort,
  type CompanyVerifyHookPort,
} from '@/modules/moderation';

const CONTENT_ID = '00000000-0000-0000-0000-000000000010';
const ACTOR = '00000000-0000-0000-0000-0000000000aa';
const MOTIVO = 'Faltou descrever as atividades exercidas no cargo anterior';

const repo = { loadStatus: vi.fn(), updateStatus: vi.fn() };
const notify = vi.fn();
const cache = vi.fn();
const hook = vi.fn();
const rejectHook = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  homeRevalidateSpy.mockClear();
  auditState.event = undefined;
  auditState.ctx = undefined;
  auditState.audit = undefined;
  repo.loadStatus.mockResolvedValue(ContentStatus.IN_MODERATION);
  repo.updateStatus.mockResolvedValue(true);
  notify.mockResolvedValue(undefined);
  cache.mockResolvedValue(undefined);
  hook.mockResolvedValue(undefined);
  rejectHook.mockResolvedValue(undefined);
  container.register(
    CONTENT_STATUS_REPOSITORY_TOKEN,
    () => repo as unknown as ContentStatusRepository,
  );
  container.register(
    MODERATION_NOTIFICATION_TOKEN,
    () => ({ sendModerationDecision: notify }) as unknown as ModerationNotificationPort,
  );
  container.register(
    CACHE_INVALIDATION_TOKEN,
    () => ({ revalidateForContent: cache }) as unknown as CacheInvalidationPort,
  );
  container.register(
    COMPANY_VERIFY_HOOK_TOKEN,
    () => ({ onContentActivated: hook, onContentRejected: rejectHook }) as unknown as CompanyVerifyHookPort,
  );
});

const approve = () =>
  transitionContent({
    contentKind: ContentKind.JOB,
    contentId: CONTENT_ID,
    to: ContentStatus.ACTIVE,
    trigger: 'MODERATOR_ACTION',
    actorPersonId: ACTOR,
  });

describe('transitionContent — caminho feliz e auditoria', () => {
  it('IN_MODERATION→ACTIVE: ok, aplica status, grava evento CONTENT_APPROVED e dispara os 3 ports', async () => {
    const res = await approve();

    expect(res).toEqual({ ok: true, data: { from: ContentStatus.IN_MODERATION, to: ContentStatus.ACTIVE } });
    expect(repo.updateStatus).toHaveBeenCalledWith(
      expect.anything(),
      ContentKind.JOB,
      CONTENT_ID,
      ContentStatus.IN_MODERATION,
      ContentStatus.ACTIVE,
    );
    expect(auditState.event).toBe(AuditEvent.CONTENT_APPROVED);
    expect(auditState.audit).toMatchObject({
      entityType: ContentKind.JOB,
      entityId: CONTENT_ID,
      before: { status: ContentStatus.IN_MODERATION },
      after: { status: ContentStatus.ACTIVE },
      justification: null,
    });
    expect(auditState.ctx).toMatchObject({ actorPersonId: ACTOR });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(cache).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledTimes(1); // só ACTIVE aciona o hook de Empresa
    expect(homeRevalidateSpy).toHaveBeenCalledTimes(1); // USP-041/T6: to=ACTIVE revalida a home
  });

  it('rejeitar com motivo: evento CONTENT_REJECTED, justificativa no audit e SEM hook de Empresa', async () => {
    const res = await transitionContent({
      contentKind: ContentKind.SERVICE,
      contentId: CONTENT_ID,
      to: ContentStatus.REJECTED,
      trigger: 'MODERATOR_ACTION',
      justification: MOTIVO,
      actorPersonId: ACTOR,
    });

    expect(res.ok).toBe(true);
    expect(auditState.event).toBe(AuditEvent.CONTENT_REJECTED);
    expect(auditState.audit?.justification).toBe(MOTIVO);
    expect(hook).not.toHaveBeenCalled(); // verificação só em ACTIVE
    expect(rejectHook).toHaveBeenCalledTimes(1); // contador de rejeição em REJECTED (USP-017)
    expect(homeRevalidateSpy).not.toHaveBeenCalled(); // USP-041/T6: sucesso, mas to != ACTIVE
  });

  it('devolver para ajustes com motivo: evento CONTENT_RETURNED_FOR_ADJUSTMENTS', async () => {
    const res = await transitionContent({
      contentKind: ContentKind.CV,
      contentId: CONTENT_ID,
      to: ContentStatus.AWAITING_ADJUSTMENTS,
      trigger: 'MODERATOR_ACTION',
      justification: MOTIVO,
      actorPersonId: ACTOR,
    });
    expect(res.ok).toBe(true);
    expect(auditState.event).toBe(AuditEvent.CONTENT_RETURNED_FOR_ADJUSTMENTS);
  });

  it('reenvio do autor (AWAITING_ADJUSTMENTS→IN_MODERATION): evento CONTENT_SUBMITTED_TO_MODERATION', async () => {
    repo.loadStatus.mockResolvedValue(ContentStatus.AWAITING_ADJUSTMENTS);
    const res = await transitionContent({
      contentKind: ContentKind.JOB,
      contentId: CONTENT_ID,
      to: ContentStatus.IN_MODERATION,
      trigger: 'AUTHOR_ACTION',
      actorPersonId: ACTOR,
    });
    expect(res.ok).toBe(true);
    expect(auditState.event).toBe(AuditEvent.CONTENT_SUBMITTED_TO_MODERATION);
  });

  it('inativação do coordenador (ACTIVE→INACTIVATED): evento CONTENT_INACTIVATED_BY_COORDINATOR', async () => {
    repo.loadStatus.mockResolvedValue(ContentStatus.ACTIVE);
    const res = await transitionContent({
      contentKind: ContentKind.JOB,
      contentId: CONTENT_ID,
      to: ContentStatus.INACTIVATED,
      trigger: 'COORDINATOR_INACTIVATION',
      justification: MOTIVO,
      actorPersonId: ACTOR,
    });
    expect(res.ok).toBe(true);
    expect(auditState.event).toBe(AuditEvent.CONTENT_INACTIVATED_BY_COORDINATOR);
  });
});

describe('transitionContent — ramos de recusa (sem efeitos)', () => {
  it('NOT_FOUND quando o conteúdo não existe', async () => {
    repo.loadStatus.mockResolvedValue(null);
    const res = await approve();
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(repo.updateStatus).not.toHaveBeenCalled();
    expect(homeRevalidateSpy).not.toHaveBeenCalled(); // USP-041/T6: caminho de erro, nunca commitou
  });

  it('INVALID_TRANSITION para transição não declarada (REJECTED→ACTIVE)', async () => {
    repo.loadStatus.mockResolvedValue(ContentStatus.REJECTED);
    const res = await approve();
    expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
    expect(repo.updateStatus).not.toHaveBeenCalled();
    expect(homeRevalidateSpy).not.toHaveBeenCalled(); // USP-041/T6: caminho de erro, nunca commitou
  });

  it('JUSTIFICATION_REQUIRED ao devolver/rejeitar com motivo insignificante', async () => {
    const res = await transitionContent({
      contentKind: ContentKind.JOB,
      contentId: CONTENT_ID,
      to: ContentStatus.AWAITING_ADJUSTMENTS,
      trigger: 'MODERATOR_ACTION',
      justification: 'x',
      actorPersonId: ACTOR,
    });
    expect(res).toMatchObject({ ok: false, error: { code: 'JUSTIFICATION_REQUIRED' } });
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('USP-023/T1: JOB ACTIVE→PAUSED (AUTHOR_ACTION) agora mapeia JOB_PAUSED (eventTypeFor kind-aware)', async () => {
    repo.loadStatus.mockResolvedValue(ContentStatus.ACTIVE);
    const res = await transitionContent({
      contentKind: ContentKind.JOB,
      contentId: CONTENT_ID,
      to: ContentStatus.PAUSED,
      trigger: 'AUTHOR_ACTION',
      actorPersonId: ACTOR,
    });
    expect(res.ok).toBe(true);
    expect(auditState.event).toBe(AuditEvent.JOB_PAUSED);
    expect(repo.updateStatus).toHaveBeenCalledTimes(1);
  });

  it('USP-023/T1: JOB PAUSED→ACTIVE (AUTHOR_ACTION) agora mapeia JOB_UNPAUSED (distingue de CONTENT_APPROVED)', async () => {
    repo.loadStatus.mockResolvedValue(ContentStatus.PAUSED);
    const res = await transitionContent({
      contentKind: ContentKind.JOB,
      contentId: CONTENT_ID,
      to: ContentStatus.ACTIVE,
      trigger: 'AUTHOR_ACTION',
      actorPersonId: ACTOR,
    });
    expect(res.ok).toBe(true);
    expect(auditState.event).toBe(AuditEvent.JOB_UNPAUSED);
    expect(homeRevalidateSpy).toHaveBeenCalledTimes(1); // USP-041/T6: to=ACTIVE revalida mesmo fora de MODERATOR_ACTION
  });

  it('preservação: CV ACTIVE→PAUSED continua INTERNAL — o ramo JOB_*/SERVICE_* não vaza para outros ContentKind', async () => {
    repo.loadStatus.mockResolvedValue(ContentStatus.ACTIVE);
    const res = await transitionContent({
      contentKind: ContentKind.CV,
      contentId: CONTENT_ID,
      to: ContentStatus.PAUSED,
      trigger: 'AUTHOR_ACTION',
      actorPersonId: ACTOR,
    });
    expect(res).toMatchObject({ ok: false, error: { code: 'INTERNAL' } });
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('USP-029/T029-2: SERVICE ACTIVE→PAUSED (AUTHOR_ACTION) mapeia SERVICE_PAUSED', async () => {
    repo.loadStatus.mockResolvedValue(ContentStatus.ACTIVE);
    const res = await transitionContent({
      contentKind: ContentKind.SERVICE,
      contentId: CONTENT_ID,
      to: ContentStatus.PAUSED,
      trigger: 'AUTHOR_ACTION',
      actorPersonId: ACTOR,
    });
    expect(res.ok).toBe(true);
    expect(auditState.event).toBe(AuditEvent.SERVICE_PAUSED);
    expect(repo.updateStatus).toHaveBeenCalledTimes(1);
  });

  it('USP-029/T029-2: SERVICE PAUSED→ACTIVE (AUTHOR_ACTION) mapeia SERVICE_UNPAUSED (distingue de CONTENT_APPROVED)', async () => {
    repo.loadStatus.mockResolvedValue(ContentStatus.PAUSED);
    const res = await transitionContent({
      contentKind: ContentKind.SERVICE,
      contentId: CONTENT_ID,
      to: ContentStatus.ACTIVE,
      trigger: 'AUTHOR_ACTION',
      actorPersonId: ACTOR,
    });
    expect(res.ok).toBe(true);
    expect(auditState.event).toBe(AuditEvent.SERVICE_UNPAUSED);
    expect(homeRevalidateSpy).toHaveBeenCalledTimes(1); // USP-041/T6: to=ACTIVE revalida a home
  });

  it('USP-029/T029-2: SERVICE ACTIVE→ARCHIVED (AUTHOR_ACTION) mapeia SERVICE_ARCHIVED', async () => {
    repo.loadStatus.mockResolvedValue(ContentStatus.ACTIVE);
    const res = await transitionContent({
      contentKind: ContentKind.SERVICE,
      contentId: CONTENT_ID,
      to: ContentStatus.ARCHIVED,
      trigger: 'AUTHOR_ACTION',
      actorPersonId: ACTOR,
    });
    expect(res.ok).toBe(true);
    expect(auditState.event).toBe(AuditEvent.SERVICE_ARCHIVED);
  });

  it('neg: CANDIDATE_PROFILE ACTIVE→ARCHIVED (AUTHOR_ACTION) continua INTERNAL — ramo SERVICE_* não vaza p/ outros kinds', async () => {
    repo.loadStatus.mockResolvedValue(ContentStatus.ACTIVE);
    const res = await transitionContent({
      contentKind: ContentKind.CANDIDATE_PROFILE,
      contentId: CONTENT_ID,
      to: ContentStatus.ARCHIVED,
      trigger: 'AUTHOR_ACTION',
      actorPersonId: ACTOR,
    });
    expect(res).toMatchObject({ ok: false, error: { code: 'INTERNAL' } });
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });
});

describe('transitionContent — transação e concorrência', () => {
  it('R3: updateStatus casa 0 linhas (decisão concorrente) → INVALID_TRANSITION', async () => {
    repo.updateStatus.mockResolvedValue(false);
    const res = await approve();
    expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
    expect(notify).not.toHaveBeenCalled(); // conflito aborta antes dos side effects
    expect(homeRevalidateSpy).not.toHaveBeenCalled(); // USP-041/T6: rollback, nunca commitou
  });

  it('INTERNAL quando a transação lança um erro inesperado', async () => {
    repo.updateStatus.mockRejectedValue(new Error('boom'));
    const res = await approve();
    expect(res).toMatchObject({ ok: false, error: { code: 'INTERNAL' } });
    expect(homeRevalidateSpy).not.toHaveBeenCalled(); // USP-041/T6: caminho de erro, nunca commitou
  });

  it('R2: falha de notificação é soft-fail — a decisão conclui ok mesmo assim', async () => {
    notify.mockRejectedValue(new Error('smtp down'));
    const res = await approve();
    expect(res.ok).toBe(true);
    expect(cache).toHaveBeenCalledTimes(1); // segue para os próximos efeitos
    expect(hook).toHaveBeenCalledTimes(1);
    expect(homeRevalidateSpy).toHaveBeenCalledTimes(1); // USP-041/T6: commit ocorreu, to=ACTIVE
  });

  it('R2: falha de invalidação de cache também é soft-fail', async () => {
    cache.mockRejectedValue(new Error('revalidate failed'));
    const res = await approve();
    expect(res.ok).toBe(true);
    expect(hook).toHaveBeenCalledTimes(1);
    expect(homeRevalidateSpy).toHaveBeenCalledTimes(1); // USP-041/T6: commit ocorreu, to=ACTIVE
  });

  it('USP-041/T6: falha da própria revalidação da home é soft-fail — a decisão conclui ok mesmo assim (backstop ISR 600s)', async () => {
    homeRevalidateSpy.mockImplementationOnce(() => {
      throw new Error('revalidatePath indisponível');
    });
    const res = await approve();
    expect(res.ok).toBe(true);
    expect(homeRevalidateSpy).toHaveBeenCalledTimes(1);
  });
});
