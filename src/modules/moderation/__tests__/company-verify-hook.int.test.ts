// Integração da verificação de Empresa na 1ª vaga (USP-017 / #156) — E-002/E-003/E-004/P-004.
// Requer Postgres local (`supabase start` + DATABASE_URL). Degrada com graça sem banco.
//
// Garantias verificadas contra o DB real, exercitando `transitionContent` + o
// adapter REAL `PrismaCompanyVerifyHook` (não um spy):
//  - aprovar a 1ª vaga marca isVerified + verifiedAt/By/JobId + snapshot e emite
//    COMPANY_VERIFIED na MESMA tx que ativa a vaga (E-002 / ADR-0024);
//  - o snapshot reflete os dados VIGENTES (edição USP-015 entre submit e moderação) — P-004;
//  - aprovar vaga de Empresa já verificada é no-op idempotente (E-004);
//  - rejeitar vaga de Empresa não verificada incrementa rejectionCount, mantém não verificada (E-003).

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import { container } from '@/shared/container';
import {
  transitionContent,
  ContentKind,
  ContentStatus,
  COMPANY_VERIFY_HOOK_TOKEN,
  PrismaCompanyVerifyHook,
  CACHE_INVALIDATION_TOKEN,
  MODERATION_NOTIFICATION_TOKEN,
  type CacheInvalidationPort,
  type ModerationNotificationPort,
} from '@/modules/moderation';

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11444777000133';

async function cleanup(): Promise<void> {
  const company = await prisma.company.findUnique({ where: { cnpj: CNPJ }, select: { id: true } });
  if (company) {
    // audit_log é append-only (ADR-T-0004) — não se apaga. As asserções filtram
    // pelo companyId vigente (UUID novo a cada teste), então linhas órfãs de
    // execuções anteriores não interferem.
    await prisma.job.deleteMany({ where: { companyId: company.id } });
    await prisma.personCompanyGrant.deleteMany({ where: { companyId: company.id } });
    await prisma.company.delete({ where: { id: company.id } });
  }
}

skipIfNoDb('USP-017 #156 — verificação de Empresa na 1ª vaga (integração)', () => {
  let actorId = '';

  beforeAll(async () => {
    const actor = await prisma.person.create({
      data: { fullName: 'Coordenador Verif Int', status: 'ATIVO' },
      select: { id: true },
    });
    actorId = actor.id;
    // Side effects soft-fail viram spies — evita next/cache fora de request.
    container.register(
      CACHE_INVALIDATION_TOKEN,
      () => ({ revalidateForContent: vi.fn().mockResolvedValue(undefined) }) as unknown as CacheInvalidationPort,
    );
    container.register(
      MODERATION_NOTIFICATION_TOKEN,
      () => ({ sendModerationDecision: vi.fn().mockResolvedValue(undefined) }) as unknown as ModerationNotificationPort,
    );
    // Garante o adapter REAL (não um stub deixado por outro teste do arquivo).
    container.register(COMPANY_VERIFY_HOOK_TOKEN, () => new PrismaCompanyVerifyHook());
  });

  beforeEach(cleanup);
  afterEach(cleanup);

  afterAll(async () => {
    await prisma.person.deleteMany({ where: { id: actorId } });
  });

  async function seedCompany(overrides: Record<string, unknown> = {}): Promise<string> {
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Empresa Verif Ltda',
        nomeFantasia: 'Empresa Verif',
        setor: 'Comércio',
        endereco: 'Rua A, 100',
        createdBy: actorId,
        ...overrides,
      },
      select: { id: true },
    });
    return company.id;
  }

  async function seedJob(companyId: string, status: ContentStatus): Promise<string> {
    const job = await prisma.job.create({
      data: {
        id: randomUUID(),
        companyId,
        authorPersonId: actorId,
        title: 'Vaga Verif',
        status: status as never,
      },
      select: { id: true },
    });
    return job.id;
  }

  const approve = (jobId: string) =>
    transitionContent({
      contentKind: ContentKind.JOB,
      contentId: jobId,
      to: ContentStatus.ACTIVE,
      trigger: 'MODERATOR_ACTION',
      actorPersonId: actorId,
    });

  it('E-002: aprovar a 1ª vaga marca isVerified + verifiedAt/By/JobId + snapshot na mesma tx', async () => {
    const companyId = await seedCompany();
    const jobId = await seedJob(companyId, ContentStatus.IN_MODERATION);

    const res = await approve(jobId);
    expect(res.ok).toBe(true);

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { isVerified: true, verifiedAt: true, verifiedByPersonId: true, verificationJobId: true, verifiedSnapshot: true },
    });
    expect(company.isVerified).toBe(true);
    expect(company.verifiedAt).not.toBeNull();
    expect(company.verifiedByPersonId).toBe(actorId);
    expect(company.verificationJobId).toBe(jobId);
    expect(company.verifiedSnapshot).toMatchObject({
      cnpj: CNPJ,
      razaoSocial: 'Empresa Verif Ltda',
      nomeFantasia: 'Empresa Verif',
      setor: 'Comércio',
      endereco: 'Rua A, 100',
    });

    // COMPANY_VERIFIED gravado no MESMO tx que aprovou a vaga (E-002 / ADR-0024).
    const verifiedAudit = await prisma.auditLog.findFirst({
      where: { action: 'COMPANY_VERIFIED', entityId: companyId },
      select: { id: true },
    });
    expect(verifiedAudit).not.toBeNull();
  });

  it('P-004: snapshot reflete os dados VIGENTES (editados via USP-015), não os do rascunho', async () => {
    const companyId = await seedCompany();
    const jobId = await seedJob(companyId, ContentStatus.IN_MODERATION);

    // Edição identitária (USP-015) entre submit e moderação.
    await prisma.company.update({
      where: { id: companyId },
      data: { razaoSocial: 'Empresa Verif RENOMEADA Ltda' },
    });

    await approve(jobId);

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { verifiedSnapshot: true },
    });
    expect((company.verifiedSnapshot as Record<string, unknown>).razaoSocial).toBe('Empresa Verif RENOMEADA Ltda');
  });

  it('E-004: aprovar vaga de Empresa já verificada é no-op (não regrava verifiedAt nem re-emite COMPANY_VERIFIED)', async () => {
    const verifiedAt = new Date('2026-01-01T12:00:00Z');
    const companyId = await seedCompany({
      isVerified: true,
      verifiedAt,
      verifiedByPersonId: actorId,
      verificationJobId: randomUUID(),
      verifiedSnapshot: { cnpj: CNPJ, razaoSocial: 'Snapshot Antigo', nomeFantasia: 'x', setor: 'y', endereco: null, capturedAt: verifiedAt.toISOString() },
    });
    const jobId = await seedJob(companyId, ContentStatus.IN_MODERATION);

    await approve(jobId);

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { verifiedAt: true, verifiedSnapshot: true },
    });
    expect(company.verifiedAt?.toISOString()).toBe(verifiedAt.toISOString()); // inalterado
    expect((company.verifiedSnapshot as Record<string, unknown>).razaoSocial).toBe('Snapshot Antigo'); // não re-snapshota

    const verifiedAudits = await prisma.auditLog.count({
      where: { action: 'COMPANY_VERIFIED', entityId: companyId },
    });
    expect(verifiedAudits).toBe(0); // nenhum novo evento
  });

  it('E-003: rejeitar vaga de Empresa não verificada incrementa rejectionCount e mantém não verificada', async () => {
    const companyId = await seedCompany();
    const jobId = await seedJob(companyId, ContentStatus.IN_MODERATION);

    const res = await transitionContent({
      contentKind: ContentKind.JOB,
      contentId: jobId,
      to: ContentStatus.REJECTED,
      trigger: 'MODERATOR_ACTION',
      justification: 'Dados da Empresa não conferem com a Receita.',
      actorPersonId: actorId,
    });
    expect(res.ok).toBe(true);

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { isVerified: true, rejectionCount: true },
    });
    expect(company.isVerified).toBe(false);
    expect(company.rejectionCount).toBe(1);
  });
});
