import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import crypto from 'node:crypto';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `registerReferralResult` (USP-038 / T2). Requer
 * Postgres local (`supabase start`) e `DATABASE_URL` no env. Cobre a matriz
 * obrigatória de Server Action sensível (happy · Zod(enum) · permission ·
 * NOT_FOUND · re-registro) e os must-nots REF38-MN-01 (enum restrito),
 * REF38-MN-02 (RBAC) e REF38-MN-03 (proveniência sempre presente).
 *
 * Mocks: identity/server/session (ator autenticado — `requirePermission`
 * importa `getCurrentPerson` deste módulo).
 */

let mockActor: CurrentPerson | null = null;

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockActor),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { registerReferralResult } = await import('../actions/register-referral-result');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '05666777000211';
const SETOR = 'Register Referral Result Int';

function socialAssistant(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: crypto.randomUUID(),
    fullName: 'Assistente Social Int Result',
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
    fullName: 'Voluntário Sem Permissão Int Result',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['VOLUNTEER'],
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('registerReferralResult — integração (USP-038 / T2)', () => {
  let asId = '';
  let volunteerId = '';
  let authorId = '';
  let companyId = '';
  let candidateId = '';
  let jobId = '';
  const referralIds: string[] = [];

  async function makeReferral() {
    const referral = await prisma.referral.create({
      data: { personId: candidateId, jobId, referrerPersonId: asId },
      select: { id: true },
    });
    referralIds.push(referral.id);
    return referral.id;
  }

  async function cleanup() {
    if (referralIds.length) {
      await prisma.referral.deleteMany({ where: { id: { in: referralIds } } });
      referralIds.length = 0;
    }
  }

  beforeAll(async () => {
    asId = crypto.randomUUID();
    volunteerId = crypto.randomUUID();
    await prisma.person.create({ data: { id: asId, fullName: 'Assistente Social Int Result', status: 'ATIVO' } });
    await prisma.person.create({
      data: { id: volunteerId, fullName: 'Voluntário Sem Permissão Int Result', status: 'ATIVO' },
    });

    const author = await prisma.person.create({
      data: { fullName: 'Register Result Int Autor', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const candidate = await prisma.person.create({
      data: { fullName: 'Register Result Int Candidato', status: 'ATIVO' },
      select: { id: true },
    });
    candidateId = candidate.id;

    const company = await prisma.company.upsert({
      where: { cnpj: CNPJ },
      update: {},
      create: {
        cnpj: CNPJ,
        razaoSocial: 'Register Referral Result Int Ltda',
        nomeFantasia: 'Register Referral Result Int',
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
      data: { companyId, authorPersonId: authorId, title: 'Vaga Register Result Int', status: 'ACTIVE', validUntil: future },
      select: { id: true },
    });
    jobId = job.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.job.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
    await prisma.person.deleteMany({ where: { id: { in: [asId, volunteerId, authorId, candidateId] } } });
  });

  afterEach(async () => {
    mockActor = null;
    await cleanup();
  });

  it('Zod: result fora do enum → VALIDATION, sem tocar o banco', async () => {
    mockActor = socialAssistant(asId);
    const referralId = await makeReferral();

    const res = await registerReferralResult({ referralId, result: 'APPROVED' as never });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });

    const referral = await prisma.referral.findUnique({ where: { id: referralId }, select: { result: true } });
    expect(referral?.result).toBeNull();
  });

  it('Zod: referralId com uuid inválido → VALIDATION, sem tocar o banco', async () => {
    mockActor = socialAssistant(asId);
    const res = await registerReferralResult({ referralId: 'not-a-uuid', result: 'HIRED' });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('@ref38-mn-02 ator sem REGISTER_REFERRAL_RESULT → FORBIDDEN, nenhuma coluna de resultado escrita', async () => {
    mockActor = volunteerNoPermission(volunteerId);
    const referralId = await makeReferral();

    const res = await registerReferralResult({ referralId, result: 'HIRED' });
    expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      select: { result: true, resultRegisteredBy: true, resultRegisteredAt: true },
    });
    expect(referral?.result).toBeNull();
    expect(referral?.resultRegisteredBy).toBeNull();
    expect(referral?.resultRegisteredAt).toBeNull();
  });

  it('EC-1: referralId inexistente → NOT_FOUND, sem escrita', async () => {
    mockActor = socialAssistant(asId);
    const res = await registerReferralResult({ referralId: crypto.randomUUID(), result: 'HIRED' });
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('@ac-038-1 @ac-038-3 @ref38-mn-03 happy: persiste resultado + observação + autor + data; audita', async () => {
    mockActor = socialAssistant(asId);
    const referralId = await makeReferral();

    const res = await registerReferralResult({
      referralId,
      result: 'HIRED',
      observation: 'Contratado após entrevista.',
    });
    expect(res).toMatchObject({ ok: true, data: { referralId } });

    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      select: { result: true, resultObservation: true, resultRegisteredBy: true, resultRegisteredAt: true },
    });
    expect(referral).toMatchObject({
      result: 'HIRED',
      resultObservation: 'Contratado após entrevista.',
      resultRegisteredBy: asId,
    });
    expect(referral?.resultRegisteredAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'REFERRAL_RESULT_REGISTERED', entityType: 'REFERRAL', entityId: referralId },
      orderBy: { occurredAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorPersonId).toBe(asId);
    expect(audit?.after).toMatchObject({ result: 'HIRED' });
  });

  it('EC-4: re-registro sobrescreve result/observação e atualiza autor/data, auditando before→after', async () => {
    mockActor = socialAssistant(asId);
    const referralId = await makeReferral();

    const first = await registerReferralResult({ referralId, result: 'UNDER_REVIEW' });
    expect(first.ok).toBe(true);

    const secondActor = crypto.randomUUID();
    await prisma.person.create({ data: { id: secondActor, fullName: 'Segundo Ator Int Result', status: 'ATIVO' } });
    mockActor = socialAssistant(secondActor);

    const second = await registerReferralResult({ referralId, result: 'HIRED', observation: 'Confirmado.' });
    expect(second.ok).toBe(true);

    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      select: { result: true, resultObservation: true, resultRegisteredBy: true },
    });
    expect(referral).toMatchObject({
      result: 'HIRED',
      resultObservation: 'Confirmado.',
      resultRegisteredBy: secondActor,
    });

    const audits = await prisma.auditLog.count({
      where: { action: 'REFERRAL_RESULT_REGISTERED', entityType: 'REFERRAL', entityId: referralId },
    });
    expect(audits).toBe(2); // um por registro — histórico preservado no audit_log

    const lastAudit = await prisma.auditLog.findFirst({
      where: { action: 'REFERRAL_RESULT_REGISTERED', entityType: 'REFERRAL', entityId: referralId },
      orderBy: { occurredAt: 'desc' },
    });
    expect(lastAudit?.before).toMatchObject({ result: 'UNDER_REVIEW' });
    expect(lastAudit?.after).toMatchObject({ result: 'HIRED' });

    await prisma.person.delete({ where: { id: secondActor } });
  });

  it('observação ausente é persistida como null (opcional)', async () => {
    mockActor = socialAssistant(asId);
    const referralId = await makeReferral();

    const res = await registerReferralResult({ referralId, result: 'NO_RESPONSE' });
    expect(res.ok).toBe(true);

    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      select: { resultObservation: true },
    });
    expect(referral?.resultObservation).toBeNull();
  });
});
