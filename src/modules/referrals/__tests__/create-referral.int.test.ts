import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import crypto from 'node:crypto';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `createReferral` (USP-037 / T6). Requer Postgres
 * local (`supabase start`) e `DATABASE_URL` no env. Cobre a matriz obrigatória
 * de Server Action sensível (happy · Zod · permission · NOT_FOUND · pré-condições
 * · concorrência) e os must-nots REF-MN-01 (unicidade ativa via índice real —
 * L-010), REF-MN-02 (vaga ACTIVE @persist, incl. revalidação dentro da tx),
 * REF-MN-03 (resumo quando sem CV) e REF-MN-04 (RBAC).
 *
 * Mocks: next/headers (IP/UA), identity/server/session (ator autenticado —
 * `requirePermission` importa `getCurrentPerson` deste módulo).
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest/int' })),
}));

let mockActor: CurrentPerson | null = null;

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockActor),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { createReferral } = await import('../actions/create-referral');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '05666777000199';
const SETOR = 'Create Referral Int';

function socialAssistant(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: crypto.randomUUID(),
    fullName: 'Assistente Social Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['SOCIAL_ASSISTANT'],
    phone: null,
    fullAddress: null,
  };
}

function volunteerNoPermission(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: crypto.randomUUID(),
    fullName: 'Voluntário Sem Permissão Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['VOLUNTEER'],
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('createReferral — integração (USP-037 / T6)', () => {
  let asId = '';
  let authorId = '';
  let volunteerId = '';
  let companyId = '';
  const personIds: string[] = [];
  const jobIds: string[] = [];

  async function cleanup() {
    if (jobIds.length) await prisma.application.deleteMany({ where: { jobId: { in: jobIds } } });
    if (jobIds.length) await prisma.referral.deleteMany({ where: { jobId: { in: jobIds } } });
    if (jobIds.length) await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    jobIds.length = 0;
    if (personIds.length) {
      await prisma.candidateProfile.deleteMany({ where: { personId: { in: personIds } } });
      await prisma.consent.deleteMany({ where: { personId: { in: personIds } } });
      await prisma.personRoleGrant.deleteMany({ where: { personId: { in: personIds } } });
      await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    }
    personIds.length = 0;
  }

  async function makePerson(fullName: string, opts: { email?: string; hasCv?: boolean } = {}) {
    const p = await prisma.person.create({
      data: { fullName, status: 'ATIVO', emailLogin: opts.email ?? null },
      select: { id: true },
    });
    personIds.push(p.id);
    if (opts.hasCv) {
      await prisma.candidateProfile.create({
        data: { personId: p.id, cvStoragePath: `cv/${p.id}.pdf` },
      });
    }
    return p.id;
  }

  async function makeJob(status: 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'DRAFT', validUntil: Date) {
    const job = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga Create Referral Int', status, validUntil },
      select: { id: true },
    });
    jobIds.push(job.id);
    return job.id;
  }

  beforeAll(async () => {
    asId = crypto.randomUUID();
    volunteerId = crypto.randomUUID();
    await prisma.person.create({ data: { id: asId, fullName: 'Assistente Social Int', status: 'ATIVO' } });
    await prisma.person.create({ data: { id: volunteerId, fullName: 'Voluntário Sem Permissão Int', status: 'ATIVO' } });

    const author = await prisma.person.create({
      data: { fullName: 'Create Referral Int Autor', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const company = await prisma.company.upsert({
      where: { cnpj: CNPJ },
      update: {},
      create: {
        cnpj: CNPJ,
        razaoSocial: 'Create Referral Int Ltda',
        nomeFantasia: 'Create Referral Int',
        setor: SETOR,
        isVerified: true,
        createdBy: authorId,
      },
      select: { id: true },
    });
    companyId = company.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: { in: [asId, volunteerId, authorId] } } });
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
  });

  afterEach(async () => {
    mockActor = null;
  });

  const future = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  })();
  const past = (() => {
    // -2 dias (não -1): `validUntil` é @db.Date truncado em UTC; entre 00:00–03:00 UTC
    // "ontem-UTC" coincide com "hoje-SP", então -1 dia empataria com hojeSaoPaulo() e a
    // vaga pareceria válida. -2 dias é inequivocamente expirado em qualquer fuso (flake L-006).
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return d;
  })();

  it('Zod: personId inválido → VALIDATION, sem tocar o banco', async () => {
    mockActor = socialAssistant(asId);
    const res = await createReferral({ personId: 'not-a-uuid', jobId: crypto.randomUUID() });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('@ref-mn-04 ator sem REFER_PERSON_TO_JOB → FORBIDDEN, zero linhas', async () => {
    mockActor = volunteerNoPermission(volunteerId);
    const personId = await makePerson('Create Referral Int Pessoa MN04', { hasCv: true });
    const jobId = await makeJob('ACTIVE', future);

    const res = await createReferral({ personId, jobId });
    expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    expect(await prisma.referral.count({ where: { jobId } })).toBe(0);
    expect(await prisma.application.count({ where: { jobId } })).toBe(0);
  });

  it('Pessoa inexistente → NOT_FOUND', async () => {
    mockActor = socialAssistant(asId);
    const jobId = await makeJob('ACTIVE', future);
    const res = await createReferral({ personId: crypto.randomUUID(), jobId });
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('vaga inexistente → NOT_FOUND', async () => {
    mockActor = socialAssistant(asId);
    const personId = await makePerson('Create Referral Int Pessoa VagaInexistente', { hasCv: true });
    const res = await createReferral({ personId, jobId: crypto.randomUUID() });
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('@ref-mn-03 sem CV + resumo vazio → VALIDATION, zero linhas', async () => {
    mockActor = socialAssistant(asId);
    const personId = await makePerson('Create Referral Int Pessoa SemCVSemResumo');
    const jobId = await makeJob('ACTIVE', future);

    const res = await createReferral({ personId, jobId });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });

    expect(await prisma.referral.count({ where: { jobId } })).toBe(0);
    expect(await prisma.application.count({ where: { jobId } })).toBe(0);
  });

  it('@ref-mn-02 vaga PAUSED → PRECONDITION_FAILED, zero linhas', async () => {
    mockActor = socialAssistant(asId);
    const personId = await makePerson('Create Referral Int Pessoa VagaPausada', { hasCv: true });
    const jobId = await makeJob('PAUSED', future);

    const res = await createReferral({ personId, jobId });
    expect(res).toMatchObject({ ok: false, error: { code: 'PRECONDITION_FAILED' } });

    expect(await prisma.referral.count({ where: { jobId } })).toBe(0);
    expect(await prisma.application.count({ where: { jobId } })).toBe(0);
  });

  it('@ref-mn-02 vaga ACTIVE porém expirada (validUntil no passado) → PRECONDITION_FAILED, zero linhas', async () => {
    mockActor = socialAssistant(asId);
    const personId = await makePerson('Create Referral Int Pessoa VagaExpirada', { hasCv: true });
    const jobId = await makeJob('ACTIVE', past);

    const res = await createReferral({ personId, jobId });
    expect(res).toMatchObject({ ok: false, error: { code: 'PRECONDITION_FAILED' } });

    expect(await prisma.referral.count({ where: { jobId } })).toBe(0);
    expect(await prisma.application.count({ where: { jobId } })).toBe(0);
  });

  it('@ref-mn-02 corrida: vaga ACTIVE→PAUSED dentro da janela (revalidação @persist) → bloqueado, zero linhas', async () => {
    mockActor = socialAssistant(asId);
    const personId = await makePerson('Create Referral Int Pessoa Flip', { hasCv: true });
    const jobId = await makeJob('ACTIVE', future);

    const [res] = await Promise.all([
      createReferral({ personId, jobId }),
      prisma.job.update({ where: { id: jobId }, data: { status: 'PAUSED' } }),
    ]);

    // Ou o pré-check ou a revalidação @persist pega o flip — em ambos os casos, bloqueado.
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('PRECONDITION_FAILED');
    }
    expect(await prisma.referral.count({ where: { jobId } })).toBe(0);
    expect(await prisma.application.count({ where: { jobId } })).toBe(0);
  });

  it('@ac-037-1 @ac-037-2 @ac-037-3 @ac-037-5 happy: sem CV + resumo — cria Referral+Application, ativa papel candidato, audita e enfileira e-mail', async () => {
    mockActor = socialAssistant(asId);
    const email = 'pessoa-happy-referral@example.com';
    const personId = await makePerson('Create Referral Int Pessoa Happy', { email });
    const jobId = await makeJob('ACTIVE', future);

    const res = await createReferral({
      personId,
      jobId,
      professionalSummary: 'Experiência em vendas e atendimento ao público.',
      justification: 'Perfil alinhado ao requisito da vaga.',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.referralId).toBeTruthy();
    expect(res.data.applicationId).toBeTruthy();

    const referral = await prisma.referral.findUnique({
      where: { id: res.data.referralId },
      select: { personId: true, jobId: true, referrerPersonId: true, professionalSummary: true, justification: true },
    });
    expect(referral).toMatchObject({
      personId,
      jobId,
      referrerPersonId: asId,
      professionalSummary: 'Experiência em vendas e atendimento ao público.',
      justification: 'Perfil alinhado ao requisito da vaga.',
    });

    const application = await prisma.application.findUnique({
      where: { id: res.data.applicationId },
      select: { jobId: true, candidatePersonId: true, viaReferralId: true, viaEncaminhamento: true, cancelledAt: true },
    });
    expect(application).toMatchObject({
      jobId,
      candidatePersonId: personId,
      viaReferralId: res.data.referralId,
      viaEncaminhamento: true,
      cancelledAt: null,
    });

    const grant = await prisma.personRoleGrant.findFirst({
      where: { personId, role: 'CANDIDATE', status: 'ACTIVE' },
    });
    expect(grant).not.toBeNull();

    const consent = await prisma.consent.findFirst({
      where: { personId, purpose: 'SOCIAL_REFERRAL_TO_JOB', revokedAt: null },
    });
    expect(consent).not.toBeNull();

    const referralCreatedAudit = await prisma.auditLog.findFirst({
      where: { action: 'REFERRAL_CREATED', entityType: 'REFERRAL', entityId: res.data.referralId },
    });
    expect(referralCreatedAudit).not.toBeNull();
    expect(referralCreatedAudit?.actorPersonId).toBe(asId);

    const candidateRoleAudit = await prisma.auditLog.findFirst({
      where: { action: 'CANDIDATE_ROLE_ACTIVATED', actorPersonId: personId },
    });
    expect(candidateRoleAudit).not.toBeNull();

    const consentGrantedAudit = await prisma.auditLog.findFirst({
      where: { action: 'CONSENT_GRANTED', actorPersonId: personId },
    });
    expect(consentGrantedAudit).not.toBeNull();

    const applicationCreatedAudit = await prisma.auditLog.findFirst({
      where: { action: 'APPLICATION_CREATED', entityType: 'APPLICATION', entityId: res.data.applicationId },
    });
    expect(applicationCreatedAudit).not.toBeNull();

    const outboxMsg = await prisma.outbox.findFirst({
      where: { topic: 'email' },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    });
    expect(outboxMsg).not.toBeNull();
    const payload = outboxMsg?.payload as { to: string; template: string; data: Record<string, unknown> };
    expect(payload.template).toBe('referral-notification');
    expect(payload.to).toBe(email);
    expect(payload.data).toMatchObject({ vagaTitulo: 'Vaga Create Referral Int' });
  });

  it('EC-2: Pessoa sem emailLogin → encaminhamento OK, e-mail não enfileirado', async () => {
    mockActor = socialAssistant(asId);
    const outboxBefore = await prisma.outbox.count({});
    const personId = await makePerson('Create Referral Int Pessoa SemEmail', { hasCv: true });
    const jobId = await makeJob('ACTIVE', future);

    const res = await createReferral({ personId, jobId });
    expect(res.ok).toBe(true);

    const outboxAfter = await prisma.outbox.count({});
    expect(outboxAfter).toBe(outboxBefore);
  });

  it('com CV: não exige resumo profissional (encaminhamento OK sem resumo)', async () => {
    mockActor = socialAssistant(asId);
    const personId = await makePerson('Create Referral Int Pessoa ComCV', { hasCv: true });
    const jobId = await makeJob('ACTIVE', future);

    const res = await createReferral({ personId, jobId });
    expect(res.ok).toBe(true);
  });

  it('@ac-037-6 mesma Pessoa → vagas diferentes: múltiplos encaminhamentos permitidos', async () => {
    mockActor = socialAssistant(asId);
    const personId = await makePerson('Create Referral Int Pessoa Multiplas', { hasCv: true });
    const jobA = await makeJob('ACTIVE', future);
    const jobB = await makeJob('ACTIVE', future);

    const resA = await createReferral({ personId, jobId: jobA });
    const resB = await createReferral({ personId, jobId: jobB });

    expect(resA.ok).toBe(true);
    expect(resB.ok).toBe(true);

    const referralCount = await prisma.referral.count({ where: { personId } });
    expect(referralCount).toBe(2);
  });

  it('@ref-mn-01 duplicata sequencial: 2º encaminhamento p/ mesma vaga com candidatura ativa → CONFLICT, 1 candidatura ativa, sem Referral órfão', async () => {
    mockActor = socialAssistant(asId);
    const personId = await makePerson('Create Referral Int Pessoa Duplicata', { hasCv: true });
    const jobId = await makeJob('ACTIVE', future);

    const first = await createReferral({ personId, jobId });
    expect(first.ok).toBe(true);

    const second = await createReferral({ personId, jobId });
    expect(second).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });

    const activeApplications = await prisma.application.count({
      where: { jobId, candidatePersonId: personId, cancelledAt: null },
    });
    expect(activeApplications).toBe(1);

    const referrals = await prisma.referral.count({ where: { personId, jobId } });
    expect(referrals).toBe(1); // só o do 1º encaminhamento — o 2º não deixou Referral órfão
  });

  it('@ref-mn-01 corrida: dois encaminhamentos concorrentes p/ mesma Pessoa/vaga → 1 ok, 1 CONFLICT (índice único parcial real — L-010)', async () => {
    mockActor = socialAssistant(asId);
    const personId = await makePerson('Create Referral Int Pessoa Corrida', { hasCv: true });
    const jobId = await makeJob('ACTIVE', future);

    const results = await Promise.all([
      createReferral({ personId, jobId }),
      createReferral({ personId, jobId }),
    ]);

    expect(results.filter((r) => r.ok).length).toBe(1);
    expect(results.filter((r) => !r.ok && r.error.code === 'CONFLICT').length).toBe(1);

    const activeApplications = await prisma.application.count({
      where: { jobId, candidatePersonId: personId, cancelledAt: null },
    });
    expect(activeApplications).toBe(1);

    const referrals = await prisma.referral.count({ where: { personId, jobId } });
    expect(referrals).toBe(1); // o attempt perdedor não deixou Referral órfão (rollback atômico)
  });
});
