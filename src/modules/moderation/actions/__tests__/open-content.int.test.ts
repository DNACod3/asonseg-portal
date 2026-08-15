import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import crypto from 'node:crypto';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Integração da Server Action `openModerationContent` (USP-066 / T6).
 * Requer Postgres local (`supabase start`) e `DATABASE_URL` no env.
 *
 * Real: Prisma/Postgres + o reader concreto de `CANDIDATE_PROFILE` (via
 * container/dispatcher). Cobre a garantia que só o DB prova:
 *  - abrir um perfil de candidato `IN_MODERATION` grava exatamente 1 linha
 *    `SENSITIVE_FIELD_VIEWED` (ator = operador, entityId = personId) — E-005;
 *  - `publicationStatus` do perfil permanece `IN_MODERATION` antes/depois — P-005
 *    (esta action é read-only; nenhum caminho passa por `transitionContent`);
 *  - abrir JOB não grava nenhum audit `SENSITIVE_FIELD_VIEWED` (só candidato audita);
 *  - permissão negada (papel sem MODERATE_CV) não grava audit nem entrega conteúdo.
 *
 * `cvStoragePath` fica `null` no fixture — GAP #4 do Planner: o bucket `cvs` pode
 * estar ausente no ambiente de CI, então `cvUrl: null` é o resultado esperado e
 * gracioso; a asserção central é a escrita do audit + o `publicationStatus`
 * inalterado, não a URL assinada em si.
 *
 * Mocks: next/headers (IP/UA) e identity/server/session (operador autenticado —
 * `requirePermission` importa `getCurrentPerson` deste módulo).
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.6', 'user-agent': 'vitest/int' })),
}));

let mockOperator: CurrentPerson | null = null;

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockOperator),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { openModerationContent } = await import('../open-content');
const { ContentKind } = await import('../../domain/content-status');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

function coordinator(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: crypto.randomUUID(),
    fullName: 'Coordenadora Int T6',
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
    fullName: 'Candidata Int T6 (sem permissão)',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['CANDIDATE'],
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('openModerationContent — integração (USP-066 / T6)', () => {
  let coordinatorId = '';
  let noPermissionId = '';
  let authorId = '';
  let companyId = '';
  const jobIds: string[] = [];
  const candidatePersonIds: string[] = [];

  const CNPJ = '39174967000180';
  const SETOR = 'Abertura de Conteúdo Int';

  async function cleanup() {
    if (jobIds.length) {
      await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
      jobIds.length = 0;
    }
    if (candidatePersonIds.length) {
      await prisma.candidateProfile.deleteMany({ where: { personId: { in: candidatePersonIds } } });
      await prisma.person.deleteMany({ where: { id: { in: candidatePersonIds } } });
      candidatePersonIds.length = 0;
    }
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
    await prisma.person.deleteMany({
      where: { id: { in: [coordinatorId, noPermissionId, authorId].filter(Boolean) } },
    });
  }

  async function seedCandidateProfile(headline: string): Promise<string> {
    const person = await prisma.person.create({
      data: { fullName: 'Candidata Conteúdo Int', status: 'ATIVO' },
      select: { id: true },
    });
    candidatePersonIds.push(person.id);
    await prisma.candidateProfile.create({
      data: {
        personId: person.id,
        headline,
        experienceText: 'Experiência integral Int',
        publicationStatus: 'IN_MODERATION',
        cvStoragePath: null,
      },
    });
    return person.id;
  }

  async function seedJob(title: string): Promise<string> {
    const job = await prisma.job.create({
      data: {
        companyId,
        authorPersonId: authorId,
        title,
        description: 'Descrição integral Int',
        status: 'IN_MODERATION',
      },
      select: { id: true },
    });
    jobIds.push(job.id);
    return job.id;
  }

  beforeAll(async () => {
    coordinatorId = crypto.randomUUID();
    noPermissionId = crypto.randomUUID();

    await prisma.person.create({
      data: { id: coordinatorId, fullName: 'Coordenadora Int T6', status: 'ATIVO' },
    });
    await prisma.person.create({
      data: { id: noPermissionId, fullName: 'Candidata Int T6 (sem permissão)', status: 'ATIVO' },
    });
    const author = await prisma.person.create({
      data: { fullName: 'Autora Vaga Int T6', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const company = await prisma.company.upsert({
      where: { cnpj: CNPJ },
      update: {},
      create: {
        cnpj: CNPJ,
        razaoSocial: 'Abertura Conteúdo Int Ltda',
        nomeFantasia: 'Abertura Conteúdo Int',
        setor: SETOR,
        isVerified: true,
        createdBy: authorId,
      },
      select: { id: true },
    });
    companyId = company.id;
  });

  afterAll(cleanup);

  afterEach(() => {
    mockOperator = null;
  });

  it('E-005/E-001: abrir CANDIDATE_PROFILE grava 1 SENSITIVE_FIELD_VIEWED (ator/entityId) e devolve o conteúdo', async () => {
    mockOperator = coordinator(coordinatorId);
    const personId = await seedCandidateProfile('Auxiliar Administrativo Int T6');

    const before = await prisma.auditLog.count({
      where: { action: 'SENSITIVE_FIELD_VIEWED', entityId: personId },
    });
    expect(before).toBe(0);

    const res = await openModerationContent({
      contentKind: ContentKind.CANDIDATE_PROFILE,
      contentId: personId,
    });

    expect(res).toMatchObject({
      ok: true,
      data: { kind: 'CANDIDATE_PROFILE', headline: 'Auxiliar Administrativo Int T6', cvUrl: null },
    });

    const audits = await prisma.auditLog.findMany({
      where: { action: 'SENSITIVE_FIELD_VIEWED', entityId: personId },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      entityType: 'candidate_profile',
      entityId: personId,
      actorPersonId: coordinatorId,
    });
  });

  it('P-005: publicationStatus do perfil permanece IN_MODERATION antes/depois de abrir o conteúdo', async () => {
    mockOperator = coordinator(coordinatorId);
    const personId = await seedCandidateProfile('Perfil P-005 Int');

    const statusBefore = await prisma.candidateProfile.findUnique({
      where: { personId },
      select: { publicationStatus: true },
    });
    expect(statusBefore?.publicationStatus).toBe('IN_MODERATION');

    const res = await openModerationContent({
      contentKind: ContentKind.CANDIDATE_PROFILE,
      contentId: personId,
    });
    expect(res.ok).toBe(true);

    const statusAfter = await prisma.candidateProfile.findUnique({
      where: { personId },
      select: { publicationStatus: true },
    });
    expect(statusAfter?.publicationStatus).toBe('IN_MODERATION');
  });

  it('JOB: abrir não grava nenhum SENSITIVE_FIELD_VIEWED (só candidato audita)', async () => {
    mockOperator = coordinator(coordinatorId);
    const jobId = await seedJob('Vaga Abertura Int T6');

    const res = await openModerationContent({ contentKind: ContentKind.JOB, contentId: jobId });

    expect(res).toMatchObject({ ok: true, data: { kind: 'JOB', title: 'Vaga Abertura Int T6' } });

    const audits = await prisma.auditLog.findMany({
      where: { action: 'SENSITIVE_FIELD_VIEWED', entityId: jobId },
    });
    expect(audits).toHaveLength(0);
  });

  it('P-002: permissão negada não grava audit nem entrega conteúdo', async () => {
    mockOperator = candidateNoPermission(noPermissionId);
    const personId = await seedCandidateProfile('Perfil P-002 Int');

    const res = await openModerationContent({
      contentKind: ContentKind.CANDIDATE_PROFILE,
      contentId: personId,
    });

    expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(res).not.toHaveProperty('data');

    const audits = await prisma.auditLog.findMany({
      where: { action: 'SENSITIVE_FIELD_VIEWED', entityId: personId },
    });
    expect(audits).toHaveLength(0);
  });
});
