import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import crypto from 'node:crypto';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração da Server Action inactivateContent (USP-018 / T4).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Real: Prisma/Postgres + `transitionContent` (única via — AC6/P-006). Cobre a
 * sequência canônica completa (Zod → requirePermission → transitionContent):
 * happy (INACT-01/03/04), motivo insuficiente (INACT-02/MN-02), sem permissão
 * (INACT-MN-03), transição inválida a partir de não-ACTIVE (INACT-07/MN-01),
 * concorrência (2ª chamada falha, sem dupla auditoria) e o seam de notificação
 * (INACT-04, soft-fail).
 *
 * Mocks: next/headers (IP/UA), identity/server/session (operador autenticado —
 * `requirePermission` importa `getCurrentPerson` deste módulo).
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.5', 'user-agent': 'vitest/int' })),
}));

let mockOperator: CurrentPerson | null = null;

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockOperator),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { container } = await import('@/shared/container');
const { inactivateContent } = await import('../actions/inactivate');
const { ContentKind } = await import('../domain/content-status');
const { MODERATION_NOTIFICATION_TOKEN } = await import('../ports/moderation-notification.port');
const { StubModerationNotification } = await import('../adapters/stub-moderation-notification');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11444777000230';
const SETOR = 'Inativação Int';
const MOTIVO = 'Vaga enganosa, empresa não localizada no endereço informado';

function coordinator(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: crypto.randomUUID(),
    fullName: 'Coordenadora Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['COORDINATOR'],
    phone: null,
    fullAddress: null,
  };
}

function candidateNoPermission(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: crypto.randomUUID(),
    fullName: 'Candidata Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['CANDIDATE'],
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('inactivateContent — integração (USP-018 / T4)', () => {
  let coordinatorId = '';
  let candidateId = '';
  let authorId = '';
  let companyId = '';
  const jobIds: string[] = [];

  async function cleanup() {
    // audit_log é append-only (DELETE bloqueado no DB — ADR-T-0004); não limpa.
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    jobIds.length = 0;
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
    await prisma.person.deleteMany({
      where: { id: { in: [coordinatorId, candidateId, authorId].filter(Boolean) } },
    });
  }

  async function seedJob(status: 'ACTIVE' | 'DRAFT' | 'PAUSED' | 'INACTIVATED'): Promise<string> {
    const job = await prisma.job.create({
      data: {
        companyId,
        authorPersonId: authorId,
        title: 'Vaga Inativação Int',
        status,
        publishedAt: status === 'ACTIVE' ? new Date() : null,
      },
      select: { id: true },
    });
    jobIds.push(job.id);
    return job.id;
  }

  beforeAll(async () => {
    coordinatorId = crypto.randomUUID();
    candidateId = crypto.randomUUID();

    await prisma.person.create({
      data: { id: coordinatorId, fullName: 'Coordenadora Int', status: 'ATIVO' },
    });
    await prisma.person.create({
      data: { id: candidateId, fullName: 'Candidata Int', status: 'ATIVO' },
    });
    const author = await prisma.person.create({
      data: { fullName: 'Autora Vaga Int', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const company = await prisma.company.upsert({
      where: { cnpj: CNPJ },
      update: {},
      create: {
        cnpj: CNPJ,
        razaoSocial: 'Inativação Int Ltda',
        nomeFantasia: 'Inativação Int',
        setor: SETOR,
        isVerified: true,
        createdBy: authorId,
      },
      select: { id: true },
    });
    companyId = company.id;
  });

  afterAll(cleanup);

  afterEach(async () => {
    mockOperator = null;
    // Limpa só as vagas criadas no teste, preserva Pessoas/Empresa fixture.
    // audit_log é append-only (DELETE bloqueado no DB — ADR-T-0004); não limpa.
    if (jobIds.length) {
      await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
      jobIds.length = 0;
    }
    container.register(MODERATION_NOTIFICATION_TOKEN, () => new StubModerationNotification());
  });

  it('INACT-01/03: happy — ACTIVE→INACTIVATED, 1 audit CONTENT_INACTIVATED_BY_COORDINATOR com before/after/justification/ator', async () => {
    mockOperator = coordinator(coordinatorId);
    const jobId = await seedJob('ACTIVE');

    const res = await inactivateContent({
      contentKind: ContentKind.JOB,
      contentId: jobId,
      justification: MOTIVO,
    });

    expect(res.ok).toBe(true);

    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
    expect(job?.status).toBe('INACTIVATED');

    const audits = await prisma.auditLog.findMany({
      where: { action: 'CONTENT_INACTIVATED_BY_COORDINATOR', entityId: jobId },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      entityType: 'JOB',
      actorPersonId: coordinatorId,
      justification: MOTIVO,
      before: { status: 'ACTIVE' },
      after: { status: 'INACTIVATED' },
    });
  });

  it('INACT-04: aciona o seam de notificação ao autor (soft-fail — falha do envio não aborta a transição)', async () => {
    mockOperator = coordinator(coordinatorId);
    const jobId = await seedJob('ACTIVE');
    const notifySpy = vi.fn().mockRejectedValue(new Error('smtp down'));
    container.register(MODERATION_NOTIFICATION_TOKEN, () => ({ sendModerationDecision: notifySpy }) as never);

    const res = await inactivateContent({ contentKind: ContentKind.JOB, contentId: jobId, justification: MOTIVO });

    expect(res.ok).toBe(true);
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({ to: 'INACTIVATED', justification: MOTIVO }));
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
    expect(job?.status).toBe('INACTIVATED'); // soft-fail: não reverte
  });

  it.each(['', 'x', '   '])(
    'INACT-02/INACT-MN-02: motivo insignificante "%s" retorna erro sem alterar o status',
    async (motivo) => {
      mockOperator = coordinator(coordinatorId);
      const jobId = await seedJob('ACTIVE');

      const res = await inactivateContent({ contentKind: ContentKind.JOB, contentId: jobId, justification: motivo });

      expect(res.ok).toBe(false);
      const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
      expect(job?.status).toBe('ACTIVE');
      const audits = await prisma.auditLog.count({ where: { entityId: jobId } });
      expect(audits).toBe(0);
    },
  );

  it('INACT-MN-03: ator sem INACTIVATE_PUBLISHED_CONTENT recebe FORBIDDEN, status inalterado', async () => {
    mockOperator = candidateNoPermission(candidateId);
    const jobId = await seedJob('ACTIVE');

    const res = await inactivateContent({ contentKind: ContentKind.JOB, contentId: jobId, justification: MOTIVO });

    expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
    expect(job?.status).toBe('ACTIVE');
    const audits = await prisma.auditLog.count({ where: { entityId: jobId } });
    expect(audits).toBe(0);
  });

  it('INACT-07/INACT-MN-01: vaga não-ACTIVE (ex.: DRAFT) retorna INVALID_TRANSITION, sem alterar status', async () => {
    mockOperator = coordinator(coordinatorId);
    const jobId = await seedJob('DRAFT');

    const res = await inactivateContent({ contentKind: ContentKind.JOB, contentId: jobId, justification: MOTIVO });

    expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
    expect(job?.status).toBe('DRAFT');
  });

  it('vaga já INACTIVATED (terminal) retorna INVALID_TRANSITION — INACT-MN-06 na via da action', async () => {
    mockOperator = coordinator(coordinatorId);
    const jobId = await seedJob('INACTIVATED');

    const res = await inactivateContent({ contentKind: ContentKind.JOB, contentId: jobId, justification: MOTIVO });

    expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
  });

  it('vaga inexistente retorna NOT_FOUND', async () => {
    mockOperator = coordinator(coordinatorId);
    const res = await inactivateContent({
      contentKind: ContentKind.JOB,
      contentId: crypto.randomUUID(),
      justification: MOTIVO,
    });
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('concorrência: 2ª inativação simultânea falha com INVALID_TRANSITION, sem dupla auditoria', async () => {
    mockOperator = coordinator(coordinatorId);
    const jobId = await seedJob('ACTIVE');

    const [a, b] = await Promise.all([
      inactivateContent({ contentKind: ContentKind.JOB, contentId: jobId, justification: `${MOTIVO} A` }),
      inactivateContent({ contentKind: ContentKind.JOB, contentId: jobId, justification: `${MOTIVO} B` }),
    ]);

    const oks = [a, b].filter((r) => r.ok);
    const fails = [a, b].filter((r) => !r.ok);
    expect(oks).toHaveLength(1);
    expect(fails).toHaveLength(1);
    if (fails[0] && !fails[0].ok) {
      expect(fails[0].error.code).toBe('INVALID_TRANSITION');
    }

    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
    expect(job?.status).toBe('INACTIVATED');
    const audits = await prisma.auditLog.count({
      where: { action: 'CONTENT_INACTIVATED_BY_COORDINATOR', entityId: jobId },
    });
    expect(audits).toBe(1);
  });
});
