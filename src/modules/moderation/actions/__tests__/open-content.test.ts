// Unit de `openModerationContent` (USP-066 / T6) — Zod → requirePermission →
// reader (container) → audit-on-read (candidato). Casos obrigatórios
// (project-guideline §12): happy (JOB/SERVICE/CANDIDATE_PROFILE), Zod
// inválido, permissão negada (P-002 — payload sem PII), reader→null (E-006),
// falha de auditoria (fail-closed, conteúdo não entregue).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, fail } from '@/shared/errors';

const requirePermission = vi.fn();
const readContent = vi.fn();
const loadStatus = vi.fn();
const containerState = vi.hoisted(() => ({ resolve: vi.fn() }));
const auditState = vi.hoisted(() => ({
  shouldThrow: false,
  calls: [] as { event: string; ctx: unknown; recorder: Record<string, unknown> }[],
}));

// A4 (PR#294) — open-content.ts agora chama headers()/clientIp antes do
// withAudit; mesmo padrão de mock de `access-report.test.ts`.
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest/open-content' }),
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

import { ContentKind, ContentStatus } from '../../domain/content-status';
import { CONTENT_STATUS_REPOSITORY_TOKEN } from '../../ports/content-status.port';
import { CONTENT_MODERATION_READER_TOKEN } from '../../ports/content-moderation-reader.port';
import { openModerationContent } from '../open-content';

const JOB_ID = '00000000-0000-0000-0000-000000000010';
const person = { id: 'mod-1' };

beforeEach(() => {
  requirePermission.mockReset();
  containerState.resolve.mockReset();
  readContent.mockReset();
  loadStatus.mockReset();
  auditState.shouldThrow = false;
  auditState.calls = [];
  requirePermission.mockResolvedValue(ok({ person }));
  // C4 (PR#294 rodada 2) — `open-content.ts` agora resolve dois tokens do
  // container: o repositório de status (precondição estrutural, checado
  // ANTES do reader) e o reader de conteúdo. Default: item IN_MODERATION
  // (caminho feliz), reader devolve o que cada teste configurar.
  loadStatus.mockResolvedValue(ContentStatus.IN_MODERATION);
  containerState.resolve.mockImplementation((token: unknown) => {
    if (token === CONTENT_STATUS_REPOSITORY_TOKEN) return { loadStatus };
    if (token === CONTENT_MODERATION_READER_TOKEN) return { readContent };
    throw new Error(`token inesperado resolvido no teste: ${String(token)}`);
  });
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
      // A4 (PR#294): ip/userAgent capturados via headers()/clientIp e
      // propagados no AuditContext — sem eles, actor_ip/user_agent
      // persistem null em audit_log (ADR-0004 passo 2 / mitigação do
      // Risco 1 do ADR-0005 para a URL assinada de CV).
      ctx: { actorPersonId: 'mod-1', ip: '10.0.0.9', userAgent: 'vitest/open-content' },
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

  it('C4 (PR#294 rodada 2): item fora de IN_MODERATION retorna NOT_FOUND sem chamar o reader de conteúdo', async () => {
    // Precondição de negócio estrutural: mesmo com permissão concedida e um
    // reader que devolveria conteúdo, `status !== IN_MODERATION` barra ANTES
    // do reader — a checagem não pode depender só do `where` do adapter.
    loadStatus.mockResolvedValue(ContentStatus.ACTIVE);
    readContent.mockResolvedValue({ kind: 'JOB', title: 'Não devia chegar aqui' });

    const res = await openModerationContent({ contentKind: ContentKind.JOB, contentId: JOB_ID });

    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(res).not.toHaveProperty('data');
    expect(loadStatus).toHaveBeenCalledWith(ContentKind.JOB, JOB_ID);
    expect(readContent).not.toHaveBeenCalled();
  });

  it('C4 (PR#294 rodada 2): item inexistente no status repo (loadStatus → null) retorna NOT_FOUND sem chamar o reader', async () => {
    loadStatus.mockResolvedValue(null);

    const res = await openModerationContent({ contentKind: ContentKind.JOB, contentId: JOB_ID });

    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(readContent).not.toHaveBeenCalled();
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
