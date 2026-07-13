import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração do participante `endJobApplicationsForRevocation`
 * (USP-053 / CAND-7 — ENCERRAR+MARCAR). Requer Postgres local (`supabase
 * start`) e `DATABASE_URL` no env. O helper recebe uma `tx` do chamador (a
 * revogação de `JOB_APPLICATION`); os testes abrem uma transação manual para
 * simular o contexto do chamador (mesmo padrão de
 * `ensure-candidate-role.int.test.ts` / `create-referral-application.int.test.ts`).
 *
 * Cobre USP053-01 (encerra+marca todas as ativas, 1 APPLICATION_CANCELLED
 * via=consent_revoke por linha), USP053-E4 (múltiplas vagas), USP053-E3
 * (concorrência com cancelamento avulso — 1 evento só), USP053-MN-01
 * (0 candidaturas ativas do titular após a cascata), USP053-MN-03 (linhas não
 * apagadas) e USP053-MN-05 (escopo estrito por titular — outra Pessoa intocada).
 */

// `cancelApplication` (USP-026, usado só no teste de concorrência E3) chama
// `getCurrentPerson` — mockado como em `cancel-application.int.test.ts`.
vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
  requireActivePerson: vi.fn(async () => mockPerson),
}));

let mockPerson: CurrentPerson | null = null;

const { prisma } = await import('@/shared/lib/prisma');
// Import relativo intra-módulo (não pelo barrel `@/modules/jobs`): o barrel
// reexporta Server Actions ('use server') que importam `next/headers`,
// indisponível no ambiente Node do Vitest (mesmo padrão de outros tx-participants).
const { endJobApplicationsForRevocation } = await import(
  '../actions/end-job-applications-for-revocation'
);
const { cancelApplication } = await import('../actions/cancel-application');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '05777888000199';
const SETOR = 'End Applications Revocation Int';
const JUSTIFICATION = 'Revogação de consentimento solicitada pelo titular.';

const ACTOR_IP = '127.0.0.1';
const ACTOR_UA = 'vitest/int';

skipIfNoDb('endJobApplicationsForRevocation — integração', () => {
  let authorId = '';
  let companyId = '';
  let jobAId = '';
  let jobBId = '';

  let titularId = ''; // titular da cascata — 2 candidaturas ativas em vagas distintas (E4)
  let outroTitularId = ''; // MN-05 — candidatura ativa própria, deve seguir intocada

  let appTitularJobA = '';
  let appTitularJobB = '';
  let appOutroTitular = '';

  async function cleanup() {
    const company = await prisma.company.findUnique({ where: { cnpj: CNPJ }, select: { id: true } });
    if (company) {
      await prisma.application.deleteMany({ where: { job: { companyId: company.id } } });
      await prisma.job.deleteMany({ where: { companyId: company.id } });
      await prisma.company.delete({ where: { id: company.id } });
    }
    await prisma.person.deleteMany({ where: { fullName: { startsWith: 'End App Revoc Int' } } });
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: 'End App Revoc Int Autor', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        razaoSocial: 'End Applications Revocation Int Ltda',
        nomeFantasia: 'End Applications Revocation Int',
        setor: SETOR,
        isVerified: true,
        createdBy: authorId,
      },
      select: { id: true },
    });
    companyId = company.id;

    const future = new Date();
    future.setDate(future.getDate() + 30);

    const jobA = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga A End App Revoc Int', status: 'ACTIVE', validUntil: future },
      select: { id: true },
    });
    jobAId = jobA.id;
    const jobB = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga B End App Revoc Int', status: 'ACTIVE', validUntil: future },
      select: { id: true },
    });
    jobBId = jobB.id;

    const titular = await prisma.person.create({
      data: { fullName: 'End App Revoc Int Titular', status: 'ATIVO' },
      select: { id: true },
    });
    titularId = titular.id;

    const outroTitular = await prisma.person.create({
      data: { fullName: 'End App Revoc Int Outro Titular', status: 'ATIVO' },
      select: { id: true },
    });
    outroTitularId = outroTitular.id;

    const aJobA = await prisma.application.create({
      data: { jobId: jobAId, candidatePersonId: titularId, viaEncaminhamento: false },
      select: { id: true },
    });
    appTitularJobA = aJobA.id;

    const aJobB = await prisma.application.create({
      data: { jobId: jobBId, candidatePersonId: titularId, viaEncaminhamento: false },
      select: { id: true },
    });
    appTitularJobB = aJobB.id;

    const aOther = await prisma.application.create({
      data: { jobId: jobAId, candidatePersonId: outroTitularId, viaEncaminhamento: false },
      select: { id: true },
    });
    appOutroTitular = aOther.id;
  });

  afterAll(async () => {
    await cleanup();
    if (authorId) await prisma.person.deleteMany({ where: { id: authorId } });
  });

  it('USP053-01/E4/MN-01: encerra+marca todas as ativas do titular (várias vagas), sem tocar outra Pessoa (MN-05)', async () => {
    const result = await prisma.$transaction(async (tx) =>
      endJobApplicationsForRevocation(tx, {
        personId: titularId,
        actorPersonId: titularId,
        ip: ACTOR_IP,
        userAgent: ACTOR_UA,
        justification: JUSTIFICATION,
      }),
    );

    expect(result.endedCount).toBe(2);
    expect(result.endedApplicationIds.sort()).toEqual([appTitularJobA, appTitularJobB].sort());

    // USP053-MN-01: 0 candidaturas ativas do titular após a cascata.
    const activeCount = await prisma.application.count({
      where: { candidatePersonId: titularId, cancelledAt: null },
    });
    expect(activeCount).toBe(0);

    // USP053-MN-03: linhas persistem — não apagadas, só cancelledAt setado.
    const rows = await prisma.application.findMany({
      where: { id: { in: [appTitularJobA, appTitularJobB] } },
      select: { id: true, cancelledAt: true },
    });
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.cancelledAt).not.toBeNull();

    // 1 APPLICATION_CANCELLED por linha, marcado via=consent_revoke (MARCAR).
    for (const id of [appTitularJobA, appTitularJobB]) {
      const audits = await prisma.auditLog.findMany({
        where: { action: 'APPLICATION_CANCELLED', entityId: id },
        select: { after: true, justification: true },
      });
      expect(audits).toHaveLength(1);
      expect(audits[0]?.after).toMatchObject({ via: 'consent_revoke' });
      expect(audits[0]?.justification).toBe(JUSTIFICATION);
    }

    // USP053-MN-05: candidatura de outro titular segue ativa e intocada.
    const other = await prisma.application.findUnique({
      where: { id: appOutroTitular },
      select: { cancelledAt: true },
    });
    expect(other?.cancelledAt).toBeNull();
  });

  it('USP053-E3: concorrência com cancelamento avulso (USP-026) da mesma candidatura — 1 só efeito, 1 evento', async () => {
    const raceJob = await prisma.job.create({
      data: {
        companyId,
        authorPersonId: authorId,
        title: 'Vaga Corrida End App Revoc Int',
        status: 'ACTIVE',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      select: { id: true },
    });
    const raceCandidate = await prisma.person.create({
      data: { fullName: 'End App Revoc Int Corrida', status: 'ATIVO' },
      select: { id: true },
    });
    const raceApp = await prisma.application.create({
      data: { jobId: raceJob.id, candidatePersonId: raceCandidate.id, viaEncaminhamento: false },
      select: { id: true },
    });

    mockPerson = {
      id: raceCandidate.id,
      supabaseUserId: raceCandidate.id,
      fullName: 'End App Revoc Int Corrida',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles: ['CANDIDATE'],
      phone: null,
      fullAddress: null,
    };

    const [cascadeResult] = await Promise.all([
      prisma.$transaction(async (tx) =>
        endJobApplicationsForRevocation(tx, {
          personId: raceCandidate.id,
          actorPersonId: raceCandidate.id,
          ip: ACTOR_IP,
          userAgent: ACTOR_UA,
          justification: JUSTIFICATION,
        }),
      ),
      (async () => {
        try {
          await cancelApplication({ applicationId: raceApp.id });
        } catch {
          // avulso pode perder a corrida — tratado pela guarda otimista.
        }
      })(),
    ]);

    const after = await prisma.application.findUnique({
      where: { id: raceApp.id },
      select: { cancelledAt: true },
    });
    expect(after?.cancelledAt).not.toBeNull();

    const auditCount = await prisma.auditLog.count({
      where: { action: 'APPLICATION_CANCELLED', entityId: raceApp.id },
    });
    expect(auditCount).toBe(1);

    // A cascata só coleta o id se ela venceu a corrida; se o cancelamento
    // avulso venceu, endedApplicationIds vem vazio para esta linha — ambos os
    // desfechos satisfazem "exatamente 1 efeito, 1 evento" (invariante testado acima).
    expect(cascadeResult.endedCount).toBeLessThanOrEqual(1);
  });
});
