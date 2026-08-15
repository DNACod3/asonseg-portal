// Unit de `openModerationContent` (USP-066 / T6) — Zod → requirePermission →
// reader (container) → audit-on-read (candidato). Casos obrigatórios
// (project-guideline §12): happy (JOB/SERVICE/CANDIDATE_PROFILE), Zod
// inválido, permissão negada (P-002 — payload sem PII), reader→null (E-006),
// falha de auditoria (fail-closed, conteúdo não entregue).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, fail } from '@/shared/errors';

const requirePermission = vi.fn();
const readContent = vi.fn();
const containerState = vi.hoisted(() => ({ resolve: vi.fn() }));
const auditState = vi.hoisted(() => ({
  shouldThrow: false,
  calls: [] as { event: string; ctx: unknown; recorder: Record<string, unknown> }[],
}));

vi.mock('@/modules/identity', () => ({ requirePermission: (...a: unknown[]) => requirePermission(...a) }));

vi.mock('@/shared/container', () => ({
  createToken: (description: string) => Symbol(description),
  container: { resolve: (token: unknown) => containerState.resolve(token) },
}));

vi.mock('@/modules/audit', () => ({
  AuditEvent: { SENSITIVE_FIELD_VIEWED: 'SENSITIVE_FIELD_VIEWED' },
  withAudit: async (
    event: string,
    fn: (tx: unknown, audit: Record<string, unknown>) => Promise<unknown>,
    ctx: unknown,
  ) => {
    if (auditState.shouldThrow) throw new Error('audit write failed (simulado)');
    const recorder: Record<string, unknown> = {};
    await fn({}, recorder);
    auditState.calls.push({ event, ctx, recorder });
    return undefined;
  },
}));

import { ContentKind } from '../../domain/content-status';
import { openModerationContent } from '../open-content';

const JOB_ID = '00000000-0000-0000-0000-000000000010';
const person = { id: 'mod-1' };

beforeEach(() => {
  requirePermission.mockReset();
  containerState.resolve.mockReset();
  readContent.mockReset();
  auditState.shouldThrow = false;
  auditState.calls = [];
  requirePermission.mockResolvedValue(ok({ person }));
  containerState.resolve.mockReturnValue({ readContent });
});

describe('USP-066 T6 — openModerationContent', () => {
  it('happy JOB: valida, checa MODERATE_JOB e devolve o view do reader (sem auditar)', async () => {
    const view = { kind: 'JOB', title: 'Vaga X', description: null };
    readContent.mockResolvedValue(view);

    const res = await openModerationContent({ contentKind: ContentKind.JOB, contentId: JOB_ID });

    expect(res).toEqual({ ok: true, data: view });
    expect(requirePermission).toHaveBeenCalledWith('MODERATE_JOB');
    expect(readContent).toHaveBeenCalledWith(ContentKind.JOB, JOB_ID);
    expect(auditState.calls).toHaveLength(0);
  });

  it('happy SERVICE: checa MODERATE_SERVICE e devolve o view (sem auditar)', async () => {
    const view = { kind: 'SERVICE', title: 'Serviço X', photos: [] };
    readContent.mockResolvedValue(view);

    const res = await openModerationContent({ contentKind: ContentKind.SERVICE, contentId: JOB_ID });

    expect(res).toEqual({ ok: true, data: view });
    expect(requirePermission).toHaveBeenCalledWith('MODERATE_SERVICE');
    expect(auditState.calls).toHaveLength(0);
  });

  it('happy CANDIDATE_PROFILE: audita SENSITIVE_FIELD_VIEWED com entityId/viewedFields/hasCv', async () => {
    const view = {
      kind: 'CANDIDATE_PROFILE',
      headline: 'Analista',
      educationLevel: null,
      educationArea: null,
      experience: 'Exp completa',
      skills: null,
      courses: null,
      cvUrl: 'https://storage/cv.pdf',
    };
    readContent.mockResolvedValue(view);

    const res = await openModerationContent({
      contentKind: ContentKind.CANDIDATE_PROFILE,
      contentId: JOB_ID,
    });

    expect(res).toEqual({ ok: true, data: view });
    expect(requirePermission).toHaveBeenCalledWith('MODERATE_CV');
    expect(auditState.calls).toHaveLength(1);
    expect(auditState.calls[0]).toMatchObject({
      event: 'SENSITIVE_FIELD_VIEWED',
      ctx: { actorPersonId: 'mod-1' },
      recorder: {
        entityType: 'candidate_profile',
        entityId: JOB_ID,
        context: { viewedFields: ['headline', 'experience', 'cv'], hasCv: true },
      },
    });
  });

  it('P-002: permissão negada retorna o erro do authz SEM nenhum campo de conteúdo, sem chamar o reader', async () => {
    requirePermission.mockResolvedValue(fail('FORBIDDEN', 'sem permissão'));

    const res = await openModerationContent({
      contentKind: ContentKind.CANDIDATE_PROFILE,
      contentId: JOB_ID,
    });

    expect(res).toEqual({ ok: false, error: { code: 'FORBIDDEN', message: 'sem permissão' } });
    // Asserção estrutural sobre o payload (P-002): nenhuma chave de PII/conteúdo presente.
    expect(res).not.toHaveProperty('data');
    expect(readContent).not.toHaveBeenCalled();
    expect(containerState.resolve).not.toHaveBeenCalled();
  });

  it('E-006: reader → null retorna NOT_FOUND', async () => {
    readContent.mockResolvedValue(null);

    const res = await openModerationContent({ contentKind: ContentKind.JOB, contentId: JOB_ID });

    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('E-005 fail-closed: falha ao auditar retorna erro e NÃO entrega o conteúdo', async () => {
    readContent.mockResolvedValue({ kind: 'CANDIDATE_PROFILE', cvUrl: null });
    auditState.shouldThrow = true;

    const res = await openModerationContent({
      contentKind: ContentKind.CANDIDATE_PROFILE,
      contentId: JOB_ID,
    });

    expect(res.ok).toBe(false);
    expect(res).not.toHaveProperty('data');
  });

  it('Zod: contentId inválido retorna VALIDATION sem checar permissão', async () => {
    const res = await openModerationContent({ contentKind: ContentKind.JOB, contentId: 'nope' });

    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(requirePermission).not.toHaveBeenCalled();
  });
});
