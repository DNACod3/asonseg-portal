// Integração das leituras de verificação de Empresa (USP-017 / #157) — E-004/D-006/P-003/D-005.
// Requer Postgres local (`supabase start` + DATABASE_URL). Degrada com graça sem banco.

import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import { withAudit, AuditEvent } from '@/modules/audit';
import {
  viewCompanyVerificationContexts,
  listCompanyRejections,
  listCompanyRejectionsByCompany,
} from '@/modules/companies';

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);
const CNPJ = '11444777000255';
const CNPJ_2 = '11444777000174';
const createdPersonIds: string[] = [];
const createdCompanyIds: string[] = [];

async function rejectJob(jobId: string, actorPersonId: string, reason: string): Promise<void> {
  // Mesma forma que transitionContent grava o evento de rejeição.
  await withAudit(
    AuditEvent.CONTENT_REJECTED,
    async (_tx, audit) => {
      audit.entityType = 'JOB';
      audit.entityId = jobId;
      audit.justification = reason;
    },
    { actorPersonId },
  );
}

async function cleanup(): Promise<void> {
  for (const cnpj of [CNPJ, CNPJ_2]) {
    const company = await prisma.company.findUnique({ where: { cnpj }, select: { id: true } });
    if (company && !createdCompanyIds.includes(company.id)) createdCompanyIds.push(company.id);
  }
  if (createdCompanyIds.length > 0) {
    await prisma.job.deleteMany({ where: { companyId: { in: createdCompanyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    createdCompanyIds.length = 0;
  }
  if (createdPersonIds.length > 0) {
    await prisma.person.deleteMany({ where: { id: { in: createdPersonIds } } });
    createdPersonIds.length = 0;
  }
}

skipIfNoDb('USP-017 #157 — leituras de verificação (integração)', () => {
  afterEach(cleanup);

  it('D-006: contexto destaca campos alterados desde o snapshot da verificação anterior', async () => {
    const actor = await prisma.person.create({
      data: { fullName: 'Coord Verif Views', status: 'ATIVO' },
      select: { id: true },
    });
    createdPersonIds.push(actor.id);
    // Empresa verificada cujo snapshot diverge dos dados vigentes (edição USP-015).
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Nome NOVO Ltda', // vigente
        nomeFantasia: 'Fantasia',
        setor: 'Comércio',
        endereco: 'Rua Nova, 200', // vigente
        createdBy: actor.id,
        isVerified: true,
        verifiedAt: new Date('2026-05-01T12:00:00Z'),
        verifiedByPersonId: actor.id,
        verifiedSnapshot: {
          cnpj: CNPJ,
          razaoSocial: 'Nome ANTIGO Ltda', // snapshot
          nomeFantasia: 'Fantasia',
          setor: 'Comércio',
          endereco: 'Rua Antiga, 100', // snapshot
          capturedAt: '2026-05-01T12:00:00.000Z',
        },
      },
      select: { id: true },
    });

    const ctxById = await viewCompanyVerificationContexts([company.id]);
    const ctx = ctxById.get(company.id);
    expect(ctx).toBeDefined();
    expect(ctx?.isVerified).toBe(true);
    expect(ctx?.verifiedByName).toBe('Coord Verif Views');
    expect(new Set(ctx?.changedSinceVerification)).toEqual(new Set(['razaoSocial', 'endereco']));

  });

  it('P-003/D-005: histórico lê CONTENT_REJECTED do audit_log derivando a Empresa pela vaga', async () => {
    const actor = await prisma.person.create({
      data: { fullName: 'Moderador Rejeição', status: 'ATIVO' },
      select: { id: true },
    });
    createdPersonIds.push(actor.id);
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Rejeitada Ltda',
        nomeFantasia: 'Rejeitada',
        setor: 'Comércio',
        createdBy: actor.id,
      },
      select: { id: true },
    });
    const job = await prisma.job.create({
      data: { companyId: company.id, authorPersonId: actor.id, title: 'Vaga Rejeitada', status: 'REJECTED' },
      select: { id: true },
    });

    await rejectJob(job.id, actor.id, 'Dados da Empresa não conferem.');

    const history = await listCompanyRejections(company.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      byName: 'Moderador Rejeição',
      reason: 'Dados da Empresa não conferem.',
    });

  });

  it('retorna vazio quando a Empresa não tem vagas (borda: sem jobs)', async () => {
    const actor = await prisma.person.create({
      data: { fullName: 'Autor Sem Vagas', status: 'ATIVO' },
      select: { id: true },
    });
    createdPersonIds.push(actor.id);
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Sem Vagas Ltda',
        nomeFantasia: 'Sem Vagas',
        setor: 'Comércio',
        createdBy: actor.id,
      },
      select: { id: true },
    });

    expect(await listCompanyRejections(company.id)).toEqual([]);
  });

  it('retorna vazio quando há vagas mas nenhuma rejeição (borda: sem CONTENT_REJECTED)', async () => {
    const actor = await prisma.person.create({
      data: { fullName: 'Autor Sem Rejeição', status: 'ATIVO' },
      select: { id: true },
    });
    createdPersonIds.push(actor.id);
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Sem Rejeição Ltda',
        nomeFantasia: 'Sem Rejeição',
        setor: 'Comércio',
        createdBy: actor.id,
      },
      select: { id: true },
    });
    await prisma.job.create({
      data: { companyId: company.id, authorPersonId: actor.id, title: 'Vaga Ativa', status: 'ACTIVE' },
    });

    expect(await listCompanyRejections(company.id)).toEqual([]);
  });

  it('ordena do mais recente para o mais antigo com 2+ rejeições', async () => {
    const actor = await prisma.person.create({
      data: { fullName: 'Moderador Ordem', status: 'ATIVO' },
      select: { id: true },
    });
    createdPersonIds.push(actor.id);
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Multi Rejeição Ltda',
        nomeFantasia: 'Multi',
        setor: 'Comércio',
        createdBy: actor.id,
      },
      select: { id: true },
    });
    const jobA = await prisma.job.create({
      data: { companyId: company.id, authorPersonId: actor.id, title: 'Vaga A', status: 'REJECTED' },
      select: { id: true },
    });
    const jobB = await prisma.job.create({
      data: { companyId: company.id, authorPersonId: actor.id, title: 'Vaga B', status: 'REJECTED' },
      select: { id: true },
    });
    await rejectJob(jobA.id, actor.id, 'Primeira rejeição');
    await rejectJob(jobB.id, actor.id, 'Segunda rejeição');

    const history = await listCompanyRejections(company.id);
    expect(history.map((r) => r.reason)).toEqual(['Segunda rejeição', 'Primeira rejeição']);
    const [first, second] = history;
    expect((first?.rejectedAt.getTime() ?? 0)).toBeGreaterThanOrEqual(second?.rejectedAt.getTime() ?? 0);
  });

  it('listCompanyRejectionsByCompany agrupa por Empresa em lote (uma passada)', async () => {
    const actor = await prisma.person.create({
      data: { fullName: 'Moderador Lote', status: 'ATIVO' },
      select: { id: true },
    });
    createdPersonIds.push(actor.id);
    const empresaA = await prisma.company.create({
      data: { cnpj: CNPJ, type: 'SIMPLES_NACIONAL', razaoSocial: 'Lote A Ltda', nomeFantasia: 'A', setor: 'Comércio', createdBy: actor.id },
      select: { id: true },
    });
    const empresaB = await prisma.company.create({
      data: { cnpj: CNPJ_2, type: 'SIMPLES_NACIONAL', razaoSocial: 'Lote B Ltda', nomeFantasia: 'B', setor: 'Serviços', createdBy: actor.id },
      select: { id: true },
    });
    const jobA = await prisma.job.create({
      data: { companyId: empresaA.id, authorPersonId: actor.id, title: 'Vaga A', status: 'REJECTED' },
      select: { id: true },
    });
    const jobB = await prisma.job.create({
      data: { companyId: empresaB.id, authorPersonId: actor.id, title: 'Vaga B', status: 'REJECTED' },
      select: { id: true },
    });
    await rejectJob(jobA.id, actor.id, 'Rejeição A');
    await rejectJob(jobB.id, actor.id, 'Rejeição B');

    const byCompany = await listCompanyRejectionsByCompany([empresaA.id, empresaB.id]);
    expect(byCompany.get(empresaA.id)?.map((r) => r.reason)).toEqual(['Rejeição A']);
    expect(byCompany.get(empresaB.id)?.map((r) => r.reason)).toEqual(['Rejeição B']);
  });

  it('listCompanyRejectionsByCompany devolve Map vazio sem ids', async () => {
    const byCompany = await listCompanyRejectionsByCompany([]);
    expect(byCompany.size).toBe(0);
  });
});
