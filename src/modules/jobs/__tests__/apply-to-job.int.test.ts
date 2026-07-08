import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `applyToJob` (USP-025 / CAN-01). Requer Postgres local
 * (`supabase start`) e `DATABASE_URL` no env. Cobre a matriz obrigatória de Server
 * Action (happy · outbox · Zod · unauth · not-found · consent-ausente ·
 * pré-condição perfil/vaga · duplicata sequencial · **concorrência/unicidade**) e
 * os must-nots CAN-025-MN-01 (unicidade ativa sob corrida), CAN-025-MN-02 (sem
 * consent → sem escrita), CAN-025-MN-03 (vaga/perfil não-elegível → sem escrita).
 */

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
  requireActivePerson: vi.fn(async () => mockPerson),
}));

let mockPerson: CurrentPerson | null = null;

const { prisma } = await import('@/shared/lib/prisma');
const { applyToJob } = await import('../actions/apply-to-job');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '05666777000155';
const SETOR = 'Apply To Job Int';

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

skipIfNoDb('applyToJob — integração', () => {
  let authorId = '';
  let companyId = '';
  let jobId = ''; // vaga ACTIVE, aberta
  let expiredJobId = ''; // vaga ACTIVE porém validUntil no passado (MN-03b)
  let raceJobId = ''; // vaga dedicada ao teste de corrida (MN-01)

  let candidateActiveId = ''; // perfil ACTIVE + consent ativo (happy/duplicata)
  let candidateDraftId = ''; // perfil DRAFT (MN-03a)
  let candidateNoConsentId = ''; // perfil ACTIVE sem consent (MN-02)
  let candidateExpiredJobId = ''; // perfil ACTIVE + consent (MN-03b)
  let candidateRaceId = ''; // perfil ACTIVE + consent (MN-01, corrida)

  async function cleanup() {
    const company = await prisma.company.findUnique({ where: { cnpj: CNPJ }, select: { id: true } });
    if (company) {
      await prisma.outbox.deleteMany({});
      await prisma.application.deleteMany({ where: { job: { companyId: company.id } } });
      await prisma.job.deleteMany({ where: { companyId: company.id } });
      await prisma.company.delete({ where: { id: company.id } });
    }
    const stalePeople = await prisma.person.findMany({
      where: { fullName: { startsWith: 'Apply Int' } },
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
      data: { fullName: 'Apply Int Autor', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        razaoSocial: 'Apply To Job Int Ltda',
        nomeFantasia: 'Apply To Job Int',
        setor: SETOR,
        isVerified: true,
        createdBy: authorId,
      },
      select: { id: true },
    });
    companyId = company.id;

    const future = new Date();
    future.setDate(future.getDate() + 30);
    const past = new Date();
    past.setDate(past.getDate() - 1);

    const job = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga Apply Int', status: 'ACTIVE', validUntil: future },
      select: { id: true },
    });
    jobId = job.id;

    const expiredJob = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga Apply Int Expirada', status: 'ACTIVE', validUntil: past },
      select: { id: true },
    });
    expiredJobId = expiredJob.id;

    const raceJob = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga Apply Int Corrida', status: 'ACTIVE', validUntil: future },
      select: { id: true },
    });
    raceJobId = raceJob.id;

    async function candidate(fullName: string, email: string, publicationStatus: 'ACTIVE' | 'DRAFT') {
      const p = await prisma.person.create({
        data: { fullName, status: 'ATIVO', emailLogin: email },
        select: { id: true },
      });
      await prisma.candidateProfile.create({ data: { personId: p.id, publicationStatus } });
      return p.id;
    }

    candidateActiveId = await candidate('Apply Int Candidato Ativo', 'candidato-ativo-apply@example.com', 'ACTIVE');
    candidateDraftId = await candidate('Apply Int Candidato Draft', 'candidato-draft-apply@example.com', 'DRAFT');
    candidateNoConsentId = await candidate('Apply Int Candidato SemConsent', 'candidato-semconsent-apply@example.com', 'ACTIVE');
    candidateExpiredJobId = await candidate('Apply Int Candidato Expirada', 'candidato-expirada-apply@example.com', 'ACTIVE');
    candidateRaceId = await candidate('Apply Int Candidato Corrida', 'candidato-corrida-apply@example.com', 'ACTIVE');

    // Consentimento JOB_APPLICATION ativo para todos, exceto o candidato "sem consent".
    for (const personId of [candidateActiveId, candidateDraftId, candidateExpiredJobId, candidateRaceId]) {
      await prisma.consent.create({
        data: { personId, purpose: 'JOB_APPLICATION', termVersion: 'v1.0', termContentHash: 'apply-int-hash' },
      });
    }
  });

  afterAll(async () => {
    await cleanup();
    if (authorId) await prisma.person.deleteMany({ where: { id: authorId } });
  });

  it('@ac-can-025-e3 Zod: jobId inválido → VALIDATION, sem tocar o banco', async () => {
    mockPerson = personOf(candidateActiveId, 'Apply Int Candidato Ativo');
    const res = await applyToJob({ jobId: 'not-a-uuid' });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('@ac-can-025-e4 unauth: sem sessão → UNAUTHENTICATED', async () => {
    mockPerson = null;
    const res = await applyToJob({ jobId });
    expect(res).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
  });

  it('@ac-can-025-e2 vaga inexistente → NOT_FOUND', async () => {
    mockPerson = personOf(candidateActiveId, 'Apply Int Candidato Ativo');
    const res = await applyToJob({ jobId: '00000000-0000-0000-0000-0000000000ff' });
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('@ac-can-025-mn-02 sem consentimento ativo → CONSENT_REQUIRED, 0 escrita', async () => {
    // Contagem global do outbox ANTES/DEPOIS (delta), não um valor absoluto: a
    // tabela `outbox` é compartilhada por toda a suíte de integração (outros
    // arquivos também escrevem nela) — um `toBe(0)` absoluto seria frágil à
    // ordem de execução dos arquivos. O que a asserção garante é que ESTA
    // chamada não enfileirou nada, que é o que CAN-025-MN-02 exige.
    const outboxBefore = await prisma.outbox.count({});

    mockPerson = personOf(candidateNoConsentId, 'Apply Int Candidato SemConsent');
    const res = await applyToJob({ jobId });
    expect(res).toMatchObject({ ok: false, error: { code: 'CONSENT_REQUIRED' } });

    const appCount = await prisma.application.count({ where: { jobId, candidatePersonId: candidateNoConsentId } });
    expect(appCount).toBe(0);
    const outboxAfter = await prisma.outbox.count({});
    expect(outboxAfter).toBe(outboxBefore);
  });

  it('@ac-can-025-mn-03a perfil DRAFT → PRECONDITION_FAILED, 0 escrita', async () => {
    mockPerson = personOf(candidateDraftId, 'Apply Int Candidato Draft');
    const res = await applyToJob({ jobId });
    expect(res).toMatchObject({ ok: false, error: { code: 'PRECONDITION_FAILED' } });

    const appCount = await prisma.application.count({ where: { jobId, candidatePersonId: candidateDraftId } });
    expect(appCount).toBe(0);
  });

  it('@ac-can-025-mn-03b vaga expirada → PRECONDITION_FAILED, 0 escrita', async () => {
    mockPerson = personOf(candidateExpiredJobId, 'Apply Int Candidato Expirada');
    const res = await applyToJob({ jobId: expiredJobId });
    expect(res).toMatchObject({ ok: false, error: { code: 'PRECONDITION_FAILED' } });

    const appCount = await prisma.application.count({
      where: { jobId: expiredJobId, candidatePersonId: candidateExpiredJobId },
    });
    expect(appCount).toBe(0);
  });

  it('@ac-can-025-01 @ac-can-025-02 happy: cria Application (viaEncaminhamento=false), audita e enfileira o e-mail', async () => {
    mockPerson = personOf(candidateActiveId, 'Apply Int Candidato Ativo');
    const res = await applyToJob({ jobId });
    expect(res).toMatchObject({ ok: true });
    if (!res.ok) return;
    expect(res.data.applicationId).toBeTruthy();

    const application = await prisma.application.findUnique({
      where: { id: res.data.applicationId },
      select: { jobId: true, candidatePersonId: true, viaEncaminhamento: true, cancelledAt: true },
    });
    expect(application).toMatchObject({
      jobId,
      candidatePersonId: candidateActiveId,
      viaEncaminhamento: false,
      cancelledAt: null,
    });

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'APPLICATION_CREATED', actorPersonId: candidateActiveId, entityType: 'APPLICATION' },
      orderBy: { occurredAt: 'desc' },
      select: { id: true, entityId: true },
    });
    expect(audit).not.toBeNull();
    expect(audit?.entityId).toBe(res.data.applicationId);

    // @ac-can-025-02 — e-mail enfileirado na mesma transação (Outbox).
    const outboxMsg = await prisma.outbox.findFirst({
      where: { topic: 'email' },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    });
    expect(outboxMsg).not.toBeNull();
    const payload = outboxMsg?.payload as { to: string; template: string; data: Record<string, unknown> };
    expect(payload.template).toBe('application-confirmation');
    expect(payload.to).toBe('candidato-ativo-apply@example.com');
    expect(payload.data).toMatchObject({ vagaTitulo: 'Vaga Apply Int' });
  });

  it('@ac-can-025-03 duplicata sequencial → CONFLICT, 1 linha ativa', async () => {
    mockPerson = personOf(candidateActiveId, 'Apply Int Candidato Ativo');
    const res = await applyToJob({ jobId });
    expect(res).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });

    const activeCount = await prisma.application.count({
      where: { jobId, candidatePersonId: candidateActiveId, cancelledAt: null },
    });
    expect(activeCount).toBe(1);
  });

  it('@ac-can-025-mn-01 corrida: duas candidaturas concorrentes do mesmo candidato → 1 ok, 1 CONFLICT (índice único parcial)', async () => {
    mockPerson = personOf(candidateRaceId, 'Apply Int Candidato Corrida');
    const results = await Promise.all([
      applyToJob({ jobId: raceJobId }),
      applyToJob({ jobId: raceJobId }),
    ]);

    expect(results.filter((r) => r.ok).length).toBe(1);
    expect(results.filter((r) => !r.ok && r.error.code === 'CONFLICT').length).toBe(1);

    const activeCount = await prisma.application.count({
      where: { jobId: raceJobId, candidatePersonId: candidateRaceId, cancelledAt: null },
    });
    expect(activeCount).toBe(1);
  });
});
