import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

/**
 * Testes de integração de `listLatestReturnReasons` (USP-054 / MOD-3 / T6 / AD-021 —
 * exercita o `where` real contra o Postgres local). Requer `supabase start`.
 *
 * Cobre: vaga devolvida com 1 registro → motivo correto (USP054-07); vaga devolvida
 * 2x → devolve o **mais recente** (USP054-08); vaga nunca devolvida → ausente do map
 * (USP054-E2); isolamento entre Empresas — só os `jobIds` passados são consultados,
 * nada de outra Empresa vaza (USP054-MN-03).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { listLatestReturnReasons } = await import('../queries/list-latest-return-reasons');
const { AuditEvent } = await import('@/modules/audit');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ_A = '11444777000410';
const CNPJ_B = '11444777000493';

skipIfNoDb('listLatestReturnReasons — integração (USP-054/MOD-3)', () => {
  let ownerId = '';
  let areaId = '';
  let regionId = '';
  let companyAId = '';
  let companyBId = '';

  // `audit_log` é append-only (REVOKE DELETE — ADR-T-0004/CLAUDE.md): a limpeza NÃO
  // tenta apagar os registros de devolução criados pelo teste. Cada `Job` nasce com
  // `id` aleatório (`@default(uuid())`), então o `entityId` do audit não colide entre
  // execuções — os registros órfãos de rodadas anteriores nunca aparecem nos `jobIds`
  // consultados pelo teste corrente.
  async function cleanup() {
    for (const cnpj of [CNPJ_A, CNPJ_B]) {
      const stale = await prisma.company.findUnique({ where: { cnpj }, select: { id: true } });
      if (stale) {
        await prisma.job.deleteMany({ where: { companyId: stale.id } });
        await prisma.personCompanyGrant.deleteMany({ where: { companyId: stale.id } });
        await prisma.company.delete({ where: { id: stale.id } });
      }
    }
  }

  beforeAll(async () => {
    await cleanup();
    const owner = await prisma.person.create({ data: { fullName: 'Dono ReturnReason Int', status: 'ATIVO' }, select: { id: true } });
    ownerId = owner.id;
    const area = await prisma.jobArea.upsert({
      where: { name: 'ReturnReason Int Área' },
      update: {},
      create: { name: 'ReturnReason Int Área' },
      select: { id: true },
    });
    areaId = area.id;
    const region = await prisma.region.upsert({
      where: { name: 'ReturnReason Int Região' },
      update: {},
      create: { name: 'ReturnReason Int Região', cityName: 'Florianópolis' },
      select: { id: true },
    });
    regionId = region.id;
  });

  beforeEach(async () => {
    await cleanup();
    const companyA = await prisma.company.create({
      data: {
        cnpj: CNPJ_A,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'ReturnReason A Ltda',
        nomeFantasia: 'ReturnReason A',
        setor: 'Comércio',
        createdBy: ownerId,
        isVerified: true,
      },
      select: { id: true },
    });
    companyAId = companyA.id;
    const companyB = await prisma.company.create({
      data: {
        cnpj: CNPJ_B,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'ReturnReason B Ltda',
        nomeFantasia: 'ReturnReason B',
        setor: 'Comércio',
        createdBy: ownerId,
        isVerified: true,
      },
      select: { id: true },
    });
    companyBId = companyB.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: ownerId } });
    await prisma.jobArea.deleteMany({ where: { name: 'ReturnReason Int Área' } });
    await prisma.region.deleteMany({ where: { name: 'ReturnReason Int Região' } });
  });

  async function createJob(companyId: string, title: string) {
    return prisma.job.create({
      data: {
        companyId,
        authorPersonId: ownerId,
        title,
        areaId,
        description: 'Descrição.',
        requirements: 'Requisitos.',
        workRegime: 'CLT',
        location: 'Local',
        contractType: 'CLT',
        regionId,
        status: 'AWAITING_ADJUSTMENTS',
      },
      select: { id: true },
    });
  }

  async function recordReturn(jobId: string, justification: string, occurredAt: Date) {
    await prisma.auditLog.create({
      data: {
        action: AuditEvent.CONTENT_RETURNED_FOR_ADJUSTMENTS,
        entityType: 'JOB',
        entityId: jobId,
        justification,
        occurredAt,
      },
    });
  }

  it('USP054-07: vaga devolvida 1x → devolve o motivo registrado', async () => {
    const job = await createJob(companyAId, 'Vaga devolvida 1x');
    await recordReturn(job.id, 'Falta descrever os requisitos', new Date('2026-06-01T10:00:00Z'));

    const result = await listLatestReturnReasons([job.id]);
    expect(result.get(job.id)).toMatchObject({ reason: 'Falta descrever os requisitos' });
  });

  it('USP054-08: vaga devolvida 2x → devolve o motivo MAIS RECENTE', async () => {
    const job = await createJob(companyAId, 'Vaga devolvida 2x');
    await recordReturn(job.id, 'Motivo antigo (1ª devolução)', new Date('2026-05-01T10:00:00Z'));
    await recordReturn(job.id, 'Motivo recente (2ª devolução)', new Date('2026-06-15T10:00:00Z'));

    const result = await listLatestReturnReasons([job.id]);
    expect(result.get(job.id)?.reason).toBe('Motivo recente (2ª devolução)');
  });

  it('USP054-E2: vaga nunca devolvida → ausente do Map (fallback é responsabilidade da UI)', async () => {
    const job = await createJob(companyAId, 'Vaga nunca devolvida');

    const result = await listLatestReturnReasons([job.id]);
    expect(result.has(job.id)).toBe(false);
  });

  it('MN-03: isolamento entre Empresas — só os jobIds passados são consultados, nada de outra Empresa vaza', async () => {
    const jobA = await createJob(companyAId, 'Vaga da Empresa A');
    await recordReturn(jobA.id, 'Motivo da Empresa A', new Date('2026-06-01T10:00:00Z'));
    const jobB = await createJob(companyBId, 'Vaga da Empresa B');
    await recordReturn(jobB.id, 'Motivo da Empresa B', new Date('2026-06-01T10:00:00Z'));

    // Chamador só passa os jobIds da Empresa A (padrão: listCompanyJobs(companyId)).
    const result = await listLatestReturnReasons([jobA.id]);
    expect(result.get(jobA.id)).toMatchObject({ reason: 'Motivo da Empresa A' });
    expect(result.has(jobB.id)).toBe(false); // não consultado — não vaza
    expect(result.size).toBe(1);
  });

  it('lista vazia de jobIds → Map vazio, sem query', async () => {
    const result = await listLatestReturnReasons([]);
    expect(result.size).toBe(0);
  });
});
