// Integração das leituras de verificação de Empresa (USP-017 / #157) — E-004/D-006/P-003/D-005.
// Requer Postgres local (`supabase start` + DATABASE_URL). Degrada com graça sem banco.

import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import { withAudit, AuditEvent } from '@/modules/audit';
import { viewCompanyVerificationContexts, listCompanyRejections } from '@/modules/companies';

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);
const CNPJ = '11444777000255';
const createdPersonIds: string[] = [];

async function cleanup(): Promise<void> {
  const company = await prisma.company.findUnique({ where: { cnpj: CNPJ }, select: { id: true } });
  if (company) {
    await prisma.job.deleteMany({ where: { companyId: company.id } });
    await prisma.company.delete({ where: { id: company.id } });
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

    // Evento de rejeição no audit_log (mesma forma que transitionContent grava).
    await withAudit(
      AuditEvent.CONTENT_REJECTED,
      async (_tx, audit) => {
        audit.entityType = 'JOB';
        audit.entityId = job.id;
        audit.justification = 'Dados da Empresa não conferem.';
      },
      { actorPersonId: actor.id },
    );

    const history = await listCompanyRejections(company.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      byName: 'Moderador Rejeição',
      reason: 'Dados da Empresa não conferem.',
    });

  });
});
