import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

/**
 * Testes de integração do aviso D-3 (USP-024 / T4 / E-003 / U24-MN-07).
 * Requer Postgres local (`supabase start`).
 *
 * Cobre `enqueueExpiryReminder` isoladamente e o passo de aviso dentro de
 * `runJobExpiration`: vaga a D-3 sem `expiryReminderSentAt` ⇒ 1 linha Outbox
 * `topic='email'` + coluna marcada; 2ª execução não reenfileira (idempotência).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { enqueueExpiryReminder } = await import('../actions/enqueue-expiry-reminder');
const { runJobExpiration } = await import('../actions/run-job-expiration');
const { hojeSaoPaulo } = await import('@/shared/lib/time');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);
const CNPJ = '11444777000330';

/** `days` a partir do dia-calendário de São Paulo — imune ao fuso do runner (L-006). */
function dateOffset(days: number): Date {
  const d = hojeSaoPaulo();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

skipIfNoDb('Aviso D-3 de expiração — integração (USP-024)', () => {
  let authorId = '';
  let companyId = '';

  async function cleanup() {
    const jobs = await prisma.job.findMany({ where: { company: { cnpj: CNPJ } }, select: { id: true } });
    if (jobs.length > 0) {
      await prisma.outbox.deleteMany({
        where: { topic: 'email', OR: jobs.map((j) => ({ payload: { path: ['jobId'], equals: j.id } })) },
      });
    }
    await prisma.job.deleteMany({ where: { company: { cnpj: CNPJ } } });
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
  }

  beforeAll(async () => {
    await cleanup();
    const author = await prisma.person.create({ data: { fullName: 'Autor Expiry Reminder Int', status: 'ATIVO' }, select: { id: true } });
    authorId = author.id;
  });

  beforeEach(async () => {
    await cleanup();
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Expiry Reminder Int Ltda',
        nomeFantasia: 'Expiry Reminder Int',
        setor: 'Comércio',
        createdBy: authorId,
        isVerified: true,
      },
      select: { id: true },
    });
    companyId = company.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: authorId } });
  });

  async function createJob(validUntil: Date, expiryReminderSentAt: Date | null = null) {
    return prisma.job.create({
      data: {
        companyId,
        authorPersonId: authorId,
        title: 'Vaga Expiry Reminder Int',
        status: 'ACTIVE',
        validUntil,
        expiryReminderSentAt,
      },
      select: { id: true },
    });
  }

  describe('enqueueExpiryReminder — unidade isolada', () => {
    it('E-003: 1ª chamada grava 1 linha Outbox topic=email e marca expiryReminderSentAt', async () => {
      const job = await createJob(dateOffset(3));

      const enqueued = await enqueueExpiryReminder(job.id);
      expect(enqueued).toBe(true);

      const row = await prisma.job.findUnique({ where: { id: job.id }, select: { expiryReminderSentAt: true } });
      expect(row?.expiryReminderSentAt).not.toBeNull();

      const outboxRows = await prisma.outbox.findMany({ where: { topic: 'email', payload: { path: ['jobId'], equals: job.id } } });
      expect(outboxRows).toHaveLength(1);
      expect(outboxRows[0]?.payload).toMatchObject({ kind: 'JOB_EXPIRY_D3', jobId: job.id });
    });

    it('U24-MN-07: 2ª chamada não reenfileira (idempotência)', async () => {
      const job = await createJob(dateOffset(3));

      await enqueueExpiryReminder(job.id);
      const second = await enqueueExpiryReminder(job.id);
      expect(second).toBe(false);

      const outboxRows = await prisma.outbox.findMany({ where: { topic: 'email', payload: { path: ['jobId'], equals: job.id } } });
      expect(outboxRows).toHaveLength(1);
    });
  });

  describe('runJobExpiration — passo de aviso D-3 integrado', () => {
    it('vaga ACTIVE a exatamente 3 dias sem lembrete é enfileirada durante a execução do cron', async () => {
      const job = await createJob(dateOffset(3));

      await runJobExpiration();

      const row = await prisma.job.findUnique({ where: { id: job.id }, select: { expiryReminderSentAt: true, status: true } });
      expect(row?.status).toBe('ACTIVE'); // não expira — só o lembrete
      expect(row?.expiryReminderSentAt).not.toBeNull();

      const outboxRows = await prisma.outbox.findMany({ where: { topic: 'email', payload: { path: ['jobId'], equals: job.id } } });
      expect(outboxRows).toHaveLength(1);
    });

    it('vaga a 3 dias já com expiryReminderSentAt não é reenfileirada por uma nova execução', async () => {
      const jaAvisada = new Date();
      const job = await createJob(dateOffset(3), jaAvisada);

      await runJobExpiration();

      const outboxRows = await prisma.outbox.findMany({ where: { topic: 'email', payload: { path: ['jobId'], equals: job.id } } });
      expect(outboxRows).toHaveLength(0);
    });

    it('vaga a 10 dias da validade não é avisada ainda (fora da janela D-3)', async () => {
      const job = await createJob(dateOffset(10));

      await runJobExpiration();

      const row = await prisma.job.findUnique({ where: { id: job.id }, select: { expiryReminderSentAt: true } });
      expect(row?.expiryReminderSentAt).toBeNull();
    });
  });
});
