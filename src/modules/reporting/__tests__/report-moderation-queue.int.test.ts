import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integração de `reportModerationQueue` (T9 — E-001/REL42-MN-02,
 * AC-042-7/MP10/MP3). Requer Postgres local.
 *
 * `queueByKind`/`activeProviders` NÃO são filtrados por período (retrato do
 * "agora") — usam a técnica de delta antes/depois do seed (mesma de
 * `home-indicators.int.test.ts`). `avgModerationHours` É filtrado por
 * período (janela distante/2019, mesma técnica de isolamento por período
 * das suítes T5..T8).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { reportModerationQueue } = await import('../queries/report-moderation-queue');
const { canViewModerationQueueReport } = await import('../domain/report-access');

const hasDb = Boolean(process.env.DATABASE_URL);

const NAME_PREFIX = 'ReportModQInt';
const CNPJ = '91000042000104';
const WINDOW_FROM = '2019-09-01';
const WINDOW_TO = '2019-09-30';
const INSIDE_SUBMIT = new Date('2019-09-10T10:00:00Z');
const OUTSIDE_SUBMIT = new Date('2018-01-01T10:00:00Z');

async function cleanup(): Promise<void> {
  // audit_log é append-only (ADR-T-0004 — trigger BEFORE DELETE + REVOKE);
  // limpeza só é possível sob a flag de sessão `app.audit_purge` (mesma porta
  // do job de retenção — ver `audit/__tests__/append-only.int.test.ts`).
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL app.audit_purge = 'on'");
    await tx.$executeRawUnsafe(
      `DELETE FROM audit_log WHERE context ->> 'seed' = '${NAME_PREFIX}'`,
    );
  });
  await prisma.service.deleteMany({ where: { title: { startsWith: NAME_PREFIX } } });
  await prisma.job.deleteMany({ where: { company: { cnpj: CNPJ } } });
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
  await prisma.delegatedPermission.deleteMany({ where: { person: { fullName: { startsWith: NAME_PREFIX } } } });
  await prisma.person.deleteMany({ where: { fullName: { startsWith: NAME_PREFIX } } });
}

describe.skipIf(!hasDb)('USP-042/T9 — reportModerationQueue (integração)', () => {
  let baseline: Awaited<ReturnType<typeof reportModerationQueue>>;
  const entityHired = randomUUID();
  const entityRejected = randomUUID();
  const entityPending = randomUUID();
  const entityOutside = randomUUID();

  beforeAll(async () => {
    await cleanup();

    baseline = await reportModerationQueue({ from: WINDOW_FROM, to: WINDOW_TO });

    const author = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Author`, status: 'ATIVO' },
      select: { id: true },
    });
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        razaoSocial: `${NAME_PREFIX} Ltda`,
        nomeFantasia: NAME_PREFIX,
        setor: 'Tecnologia',
        createdBy: author.id,
      },
      select: { id: true },
    });

    // Fila atual: 2 jobs IN_MODERATION, 1 AWAITING_ADJUSTMENTS.
    await prisma.job.createMany({
      data: [
        { companyId: company.id, authorPersonId: author.id, title: `${NAME_PREFIX} Q1`, status: 'IN_MODERATION' },
        { companyId: company.id, authorPersonId: author.id, title: `${NAME_PREFIX} Q2`, status: 'IN_MODERATION' },
        {
          companyId: company.id,
          authorPersonId: author.id,
          title: `${NAME_PREFIX} Q3`,
          status: 'AWAITING_ADJUSTMENTS',
        },
      ],
    });

    // MP3: 2 prestadores distintos com serviço ACTIVE.
    const provider1 = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Provider 1`, status: 'ATIVO' },
      select: { id: true },
    });
    const provider2 = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Provider 2`, status: 'ATIVO' },
      select: { id: true },
    });
    await prisma.service.createMany({
      data: [
        { authorPersonId: provider1.id, title: `${NAME_PREFIX} Svc 1`, status: 'ACTIVE' },
        { authorPersonId: provider2.id, title: `${NAME_PREFIX} Svc 2`, status: 'ACTIVE' },
      ],
    });

    // MP10: pares submit->decisão no audit_log.
    await prisma.auditLog.createMany({
      data: [
        {
          action: 'CONTENT_SUBMITTED_TO_MODERATION',
          entityId: entityHired,
          occurredAt: INSIDE_SUBMIT,
          context: { seed: NAME_PREFIX },
        },
        {
          action: 'CONTENT_APPROVED',
          entityId: entityHired,
          occurredAt: new Date(INSIDE_SUBMIT.getTime() + 3 * 3_600_000), // +3h
          context: { seed: NAME_PREFIX },
        },
        {
          action: 'CONTENT_SUBMITTED_TO_MODERATION',
          entityId: entityRejected,
          occurredAt: INSIDE_SUBMIT,
          context: { seed: NAME_PREFIX },
        },
        {
          action: 'CONTENT_REJECTED',
          entityId: entityRejected,
          occurredAt: new Date(INSIDE_SUBMIT.getTime() + 5 * 3_600_000), // +5h
          context: { seed: NAME_PREFIX },
        },
        {
          action: 'CONTENT_SUBMITTED_TO_MODERATION',
          entityId: entityPending,
          occurredAt: INSIDE_SUBMIT,
          context: { seed: NAME_PREFIX },
        }, // sem decisão ainda
        {
          action: 'CONTENT_SUBMITTED_TO_MODERATION',
          entityId: entityOutside,
          occurredAt: OUTSIDE_SUBMIT,
          context: { seed: NAME_PREFIX },
        },
        {
          action: 'CONTENT_APPROVED',
          entityId: entityOutside,
          occurredAt: new Date(OUTSIDE_SUBMIT.getTime() + 1 * 3_600_000),
          context: { seed: NAME_PREFIX },
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it('AC-042-7: fila atual soma +2 IN_MODERATION e +1 AWAITING_ADJUSTMENTS ao JOB (delta)', async () => {
    const report = await reportModerationQueue({ from: WINDOW_FROM, to: WINDOW_TO });
    expect(report.queueByKind.JOB - baseline.queueByKind.JOB).toBe(3);
  });

  it('MP3: activeProviders soma +2 (delta) — os 2 prestadores semeados', async () => {
    const report = await reportModerationQueue({ from: WINDOW_FROM, to: WINDOW_TO });
    expect(report.activeProviders - baseline.activeProviders).toBe(2);
  });

  it('MP10: avgModerationHours = 4 (média de 3h e 5h) — SOMENTE pares dentro da janela', async () => {
    const report = await reportModerationQueue({ from: WINDOW_FROM, to: WINDOW_TO });
    expect(report.avgModerationHours).toBe(4);
  });

  it('MP10: par fora da janela (entityOutside) não entra na média — janela 1999 não vê nenhum par semeado', async () => {
    const report = await reportModerationQueue({ from: '1999-01-01', to: '1999-01-31' });
    expect(report.avgModerationHours).toBeNull();
  });

  it('REL42-MN-02 (negativo, integração real): voluntário sem MODERATE_* delegado no DB → canViewModerationQueueReport nega', async () => {
    const volunteer = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Volunteer`, status: 'ATIVO' },
      select: { id: true },
    });
    const currentPerson = {
      id: volunteer.id,
      supabaseUserId: 'sb-vol',
      fullName: `${NAME_PREFIX} Volunteer`,
      status: 'ATIVO' as const,
      primeiroAcesso: false,
      roles: ['VOLUNTEER'],
      phone: null,
      fullAddress: null,
    };

    const grantsBefore = await prisma.delegatedPermission.findMany({
      where: { personId: volunteer.id, permission: { in: ['MODERATE_JOB', 'MODERATE_CV', 'MODERATE_SERVICE'] }, revokedAt: null },
      select: { permission: true, scopeArea: true, revokedAt: true },
    });
    expect(canViewModerationQueueReport(currentPerson, grantsBefore)).toBe(false);

    await prisma.delegatedPermission.create({
      data: { personId: volunteer.id, permission: 'MODERATE_JOB', grantedBy: volunteer.id },
    });
    const grantsAfter = await prisma.delegatedPermission.findMany({
      where: { personId: volunteer.id, permission: { in: ['MODERATE_JOB', 'MODERATE_CV', 'MODERATE_SERVICE'] }, revokedAt: null },
      select: { permission: true, scopeArea: true, revokedAt: true },
    });
    expect(canViewModerationQueueReport(currentPerson, grantsAfter)).toBe(true);
  });
});
