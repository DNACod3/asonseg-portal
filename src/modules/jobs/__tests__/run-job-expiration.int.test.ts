import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

/**
 * Testes de integração de `runJobExpiration` (USP-024 / T3 / E-001 / AC-024-1).
 * Requer Postgres local (`supabase start`).
 *
 * Cobre: expira vaga ACTIVE vencida (JOB_EXPIRED); ignora vigente/PAUSED/DRAFT/ARCHIVED;
 * idempotência (2ª execução é no-op); sem exclusão física (P-005); validUntil exatamente
 * hoje mantém ACTIVE (fronteira P-002); resumo `{expired:0}` sem vagas vencidas.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { runJobExpiration } = await import('../actions/run-job-expiration');
const { hojeSaoPaulo } = await import('@/shared/lib/time');
const { SYSTEM_ACTOR_ID } = await import('@/shared/system-actor');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11444777000300';

/** `days` a partir do dia-calendário de São Paulo — imune ao fuso do runner (L-006). */
function dateOffset(days: number): Date {
  const d = hojeSaoPaulo();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

skipIfNoDb('runJobExpiration — integração (USP-024)', () => {
  let authorId = '';
  let companyId = '';

  async function cleanup() {
    await prisma.job.deleteMany({ where: { company: { cnpj: CNPJ } } });
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
  }

  beforeAll(async () => {
    await cleanup();
    const author = await prisma.person.create({ data: { fullName: 'Autor Expiration Int', status: 'ATIVO' }, select: { id: true } });
    authorId = author.id;
    // Garante o ator de sistema (normalmente vem do seed; idempotente).
    await prisma.person.upsert({
      where: { id: SYSTEM_ACTOR_ID },
      update: {},
      create: { id: SYSTEM_ACTOR_ID, fullName: 'Sistema (job automático)', status: 'ATIVO' },
    });
  });

  beforeEach(async () => {
    await cleanup();
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Expiration Int Ltda',
        nomeFantasia: 'Expiration Int',
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

  async function createJob(status: 'ACTIVE' | 'PAUSED' | 'DRAFT' | 'ARCHIVED' | 'EXPIRED', validUntil: Date | null) {
    return prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: `Vaga Expiration Int ${status}`, status, validUntil },
      select: { id: true },
    });
  }

  it('E-001: expira vaga ACTIVE vencida, grava JOB_EXPIRED; vigente e já-EXPIRED ficam inalteradas', async () => {
    const vencida = await createJob('ACTIVE', dateOffset(-1));
    const vigente = await createJob('ACTIVE', dateOffset(30));
    const jaExpirada = await createJob('EXPIRED', dateOffset(-10));

    const res = await runJobExpiration();
    expect(res.expired).toBe(1);
    expect(res.scanned).toBe(1);

    const rowVencida = await prisma.job.findUnique({ where: { id: vencida.id }, select: { status: true } });
    expect(rowVencida?.status).toBe('EXPIRED');

    const entry = await prisma.auditLog.findFirst({
      where: { action: 'JOB_EXPIRED', entityId: vencida.id },
      select: { before: true, after: true },
    });
    expect(entry).not.toBeNull();
    expect(entry).toMatchObject({ before: { status: 'ACTIVE' }, after: { status: 'EXPIRED' } });

    const rowVigente = await prisma.job.findUnique({ where: { id: vigente.id }, select: { status: true } });
    expect(rowVigente?.status).toBe('ACTIVE');

    const rowJaExpirada = await prisma.job.findUnique({ where: { id: jaExpirada.id }, select: { status: true } });
    expect(rowJaExpirada?.status).toBe('EXPIRED');
  });

  it('sem vagas vencidas → { expired: 0, scanned: 0 } sem erro', async () => {
    await createJob('ACTIVE', dateOffset(30));
    const res = await runJobExpiration();
    expect(res).toEqual({ expired: 0, scanned: 0 });
  });

  it.each(['PAUSED', 'DRAFT', 'ARCHIVED'] as const)('vaga %s vencida NÃO é expirada (só ACTIVE→EXPIRED)', async (status) => {
    const job = await createJob(status, dateOffset(-5));
    await runJobExpiration();
    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true } });
    expect(row?.status).toBe(status);
  });

  it('P-002 (borda): validUntil exatamente hoje mantém a vaga ACTIVE', async () => {
    const job = await createJob('ACTIVE', dateOffset(0));
    const res = await runJobExpiration();
    expect(res.expired).toBe(0);
    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true } });
    expect(row?.status).toBe('ACTIVE');
  });

  it('U24-MN-07: reexecução sobre vaga já expirada é idempotente (não re-expira nem duplica auditoria)', async () => {
    const job = await createJob('ACTIVE', dateOffset(-1));

    await runJobExpiration();
    const first = await prisma.auditLog.count({ where: { action: 'JOB_EXPIRED', entityId: job.id } });
    expect(first).toBe(1);

    const second = await runJobExpiration();
    expect(second.expired).toBe(0); // não re-seleciona (status já EXPIRED)

    const auditCount = await prisma.auditLog.count({ where: { action: 'JOB_EXPIRED', entityId: job.id } });
    expect(auditCount).toBe(1); // sem duplicação
  });

  it('P-005: expirar não apaga a vaga nem suas candidaturas', async () => {
    const job = await createJob('ACTIVE', dateOffset(-1));
    const candidate = await prisma.person.create({ data: { fullName: 'Candidato Expiration Int', status: 'ATIVO' }, select: { id: true } });
    const application = await prisma.application.create({
      data: { candidatePersonId: candidate.id, jobId: job.id },
      select: { id: true },
    });

    await runJobExpiration();

    const row = await prisma.job.findUnique({ where: { id: job.id } });
    expect(row).not.toBeNull();
    expect(row?.status).toBe('EXPIRED');

    const stillThere = await prisma.application.findUnique({ where: { id: application.id } });
    expect(stillThere).not.toBeNull();

    await prisma.application.deleteMany({ where: { id: application.id } });
    await prisma.person.deleteMany({ where: { id: candidate.id } });
  });
});
