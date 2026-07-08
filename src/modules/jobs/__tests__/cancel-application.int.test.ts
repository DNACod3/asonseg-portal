import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `cancelApplication` (USP-026 / CAN-02). Requer Postgres
 * local (`supabase start`) e `DATABASE_URL` no env. Cobre a matriz obrigatória de
 * Server Action (happy · recandidatura · Zod · unauth · not-found/terceiro ·
 * já-cancelada · **concorrência**) e os must-nots CAN-026-MN-01 (cancelar de
 * terceiro → NOT_FOUND, sem efeito) e CAN-026-MN-02 (idempotência — duplo
 * cancelamento não muta estado nem audita duas vezes).
 */

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
  requireActivePerson: vi.fn(async () => mockPerson),
}));

let mockPerson: CurrentPerson | null = null;

const { prisma } = await import('@/shared/lib/prisma');
const { cancelApplication } = await import('../actions/cancel-application');
const { applyToJob } = await import('../actions/apply-to-job');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '05777888000133';
const SETOR = 'Cancel Application Int';

function personOf(id: string, fullName: string): CurrentPerson {
  return {
    id,
    supabaseUserId: id,
    fullName,
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['CANDIDATE'],
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('cancelApplication — integração', () => {
  let authorId = '';
  let companyId = '';
  let jobId = '';

  let candidateAId = ''; // dona da candidatura "happy"/recandidatura
  let candidateBId = ''; // terceiro (MN-01)
  let candidateRaceId = ''; // corrida (E5)

  let applicationHappyId = '';
  let applicationOfAId = ''; // candidatura de A que B tentará cancelar (MN-01)
  let applicationAlreadyCancelledId = ''; // já cancelada previamente (MN-02/E1)
  let applicationRaceId = ''; // candidatura da corrida (E5)

  async function cleanup() {
    const company = await prisma.company.findUnique({ where: { cnpj: CNPJ }, select: { id: true } });
    if (company) {
      await prisma.application.deleteMany({ where: { job: { companyId: company.id } } });
      await prisma.job.deleteMany({ where: { companyId: company.id } });
      await prisma.company.delete({ where: { id: company.id } });
    }
    const stalePeople = await prisma.person.findMany({
      where: { fullName: { startsWith: 'Cancel Int' } },
      select: { id: true },
    });
    if (stalePeople.length > 0) {
      const ids = stalePeople.map((p) => p.id);
      await prisma.consent.deleteMany({ where: { personId: { in: ids } } });
      await prisma.candidateProfile.deleteMany({ where: { personId: { in: ids } } });
      await prisma.person.deleteMany({ where: { id: { in: ids } } });
    }
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: 'Cancel Int Autor', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        razaoSocial: 'Cancel Application Int Ltda',
        nomeFantasia: 'Cancel Application Int',
        setor: SETOR,
        isVerified: true,
        createdBy: authorId,
      },
      select: { id: true },
    });
    companyId = company.id;

    const future = new Date();
    future.setDate(future.getDate() + 30);

    const job = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga Cancel Int', status: 'ACTIVE', validUntil: future },
      select: { id: true },
    });
    jobId = job.id;

    async function candidate(fullName: string, email: string) {
      const p = await prisma.person.create({
        data: { fullName, status: 'ATIVO', emailLogin: email },
        select: { id: true },
      });
      await prisma.candidateProfile.create({ data: { personId: p.id, publicationStatus: 'ACTIVE' } });
      await prisma.consent.create({
        data: { personId: p.id, purpose: 'JOB_APPLICATION', termVersion: 'v1.0', termContentHash: 'cancel-int-hash' },
      });
      return p.id;
    }

    candidateAId = await candidate('Cancel Int Candidato A', 'candidato-a-cancel@example.com');
    candidateBId = await candidate('Cancel Int Candidato B', 'candidato-b-cancel@example.com');
    candidateRaceId = await candidate('Cancel Int Candidato Corrida', 'candidato-corrida-cancel@example.com');

    const applicationHappy = await prisma.application.create({
      data: { jobId, candidatePersonId: candidateAId, viaEncaminhamento: false },
      select: { id: true },
    });
    applicationHappyId = applicationHappy.id;
    applicationOfAId = applicationHappyId;

    const applicationAlreadyCancelled = await prisma.application.create({
      data: { jobId, candidatePersonId: candidateBId, viaEncaminhamento: false, cancelledAt: new Date() },
      select: { id: true },
    });
    applicationAlreadyCancelledId = applicationAlreadyCancelled.id;

    const applicationRace = await prisma.application.create({
      data: { jobId, candidatePersonId: candidateRaceId, viaEncaminhamento: false },
      select: { id: true },
    });
    applicationRaceId = applicationRace.id;
  });

  afterAll(async () => {
    await cleanup();
    if (authorId) await prisma.person.deleteMany({ where: { id: authorId } });
  });

  it('@ac-can-026-e3 Zod: applicationId inválido → VALIDATION', async () => {
    mockPerson = personOf(candidateAId, 'Cancel Int Candidato A');
    const res = await cancelApplication({ applicationId: 'not-a-uuid' });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('@ac-can-026-e4 unauth: sem sessão → UNAUTHENTICATED', async () => {
    mockPerson = null;
    const res = await cancelApplication({ applicationId: applicationHappyId });
    expect(res).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
  });

  it('@ac-can-026-mn-01 PessoaB cancela candidatura da PessoaA → NOT_FOUND, sem efeito', async () => {
    mockPerson = personOf(candidateBId, 'Cancel Int Candidato B');
    const res = await cancelApplication({ applicationId: applicationOfAId });
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });

    const stillActive = await prisma.application.findUnique({
      where: { id: applicationOfAId },
      select: { cancelledAt: true },
    });
    expect(stillActive?.cancelledAt).toBeNull();

    const auditCount = await prisma.auditLog.count({
      where: { action: 'APPLICATION_CANCELLED', entityId: applicationOfAId },
    });
    expect(auditCount).toBe(0);
  });

  it('@ac-can-026-e1 @ac-can-026-mn-02 (1/2) cancelar candidatura já cancelada → PRECONDITION_FAILED, sem alterar cancelledAt', async () => {
    const before = await prisma.application.findUnique({
      where: { id: applicationAlreadyCancelledId },
      select: { cancelledAt: true },
    });

    mockPerson = personOf(candidateBId, 'Cancel Int Candidato B');
    const res = await cancelApplication({ applicationId: applicationAlreadyCancelledId });
    expect(res).toMatchObject({ ok: false, error: { code: 'PRECONDITION_FAILED' } });

    const after = await prisma.application.findUnique({
      where: { id: applicationAlreadyCancelledId },
      select: { cancelledAt: true },
    });
    expect(after?.cancelledAt?.toISOString()).toBe(before?.cancelledAt?.toISOString());
  });

  it('@ac-can-026-01 happy: preenche cancelledAt, audita e cai da contagem ativa', async () => {
    mockPerson = personOf(candidateAId, 'Cancel Int Candidato A');
    const res = await cancelApplication({ applicationId: applicationHappyId });
    expect(res).toMatchObject({ ok: true, data: { applicationId: applicationHappyId } });

    const application = await prisma.application.findUnique({
      where: { id: applicationHappyId },
      select: { cancelledAt: true },
    });
    expect(application?.cancelledAt).not.toBeNull();

    const activeCount = await prisma.application.count({
      where: { jobId, candidatePersonId: candidateAId, cancelledAt: null },
    });
    expect(activeCount).toBe(0);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'APPLICATION_CANCELLED', actorPersonId: candidateAId, entityId: applicationHappyId },
      select: { id: true },
    });
    expect(audit).not.toBeNull();
  });

  it('@ac-can-026-mn-02 (2/2) cancelar 2x a mesma candidatura → 2º retorna PRECONDITION_FAILED, 1 evento de auditoria', async () => {
    mockPerson = personOf(candidateAId, 'Cancel Int Candidato A');
    const res = await cancelApplication({ applicationId: applicationHappyId });
    expect(res).toMatchObject({ ok: false, error: { code: 'PRECONDITION_FAILED' } });

    const auditCount = await prisma.auditLog.count({
      where: { action: 'APPLICATION_CANCELLED', entityId: applicationHappyId },
    });
    expect(auditCount).toBe(1);
  });

  it('@ac-can-026-02 recandidatura: cancelar libera nova applyToJob à mesma vaga (índice único parcial)', async () => {
    mockPerson = personOf(candidateAId, 'Cancel Int Candidato A');
    const res = await applyToJob({ jobId });
    expect(res).toMatchObject({ ok: true });

    const activeCount = await prisma.application.count({
      where: { jobId, candidatePersonId: candidateAId, cancelledAt: null },
    });
    expect(activeCount).toBe(1);
  });

  it('@ac-can-026-e5 corrida: dois cancelamentos concorrentes da mesma candidatura → 1 ok, 1 erro, 1 auditoria', async () => {
    mockPerson = personOf(candidateRaceId, 'Cancel Int Candidato Corrida');
    const results = await Promise.all([
      cancelApplication({ applicationId: applicationRaceId }),
      cancelApplication({ applicationId: applicationRaceId }),
    ]);

    expect(results.filter((r) => r.ok).length).toBe(1);
    expect(results.filter((r) => !r.ok).length).toBe(1);

    const auditCount = await prisma.auditLog.count({
      where: { action: 'APPLICATION_CANCELLED', entityId: applicationRaceId },
    });
    expect(auditCount).toBe(1);
  });
});
