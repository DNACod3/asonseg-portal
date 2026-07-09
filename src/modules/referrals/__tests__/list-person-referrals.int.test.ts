import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';

/**
 * Testes de integração de `listPersonReferrals` (USP-039 / T3 — dimensão
 * "encaminhamentos" do painel consolidado). Requer Postgres local (`supabase
 * start`). Exercita o `where: { personId }` real (a Pessoa ENCAMINHADA, não o
 * encaminhador) — lição AD-021.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { listPersonReferrals } = await import('../queries/list-person-referrals');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11444777000260';
const SETOR = 'Encaminhamentos Consolidado Int';

skipIfNoDb('listPersonReferrals — integração', () => {
  let companyId = '';
  let authorId = '';
  let referrerId = '';
  let jobId = '';
  let targetPersonId = '';
  let otherPersonId = '';
  let emptyPersonId = '';

  async function cleanup() {
    await prisma.referral.deleteMany({ where: { job: { company: { cnpj: CNPJ } } } });
    await prisma.job.deleteMany({ where: { company: { cnpj: CNPJ } } });
    await prisma.personCompanyGrant.deleteMany({ where: { company: { cnpj: CNPJ } } });
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
    await prisma.person.deleteMany({ where: { fullName: { startsWith: 'Consolidado Referrals Int' } } });
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: 'Consolidado Referrals Int Autor', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const referrer = await prisma.person.create({
      data: { fullName: 'Consolidado Referrals Int Encaminhador', status: 'ATIVO' },
      select: { id: true },
    });
    referrerId = referrer.id;

    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        razaoSocial: 'Consolidado Referrals Int Ltda',
        nomeFantasia: 'Consolidado Referrals Int',
        setor: SETOR,
        isVerified: true,
        createdBy: authorId,
      },
      select: { id: true },
    });
    companyId = company.id;

    const job = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga Consolidado Referrals Int', status: 'ACTIVE' },
      select: { id: true },
    });
    jobId = job.id;

    const [target, other, empty] = await Promise.all([
      prisma.person.create({
        data: { fullName: 'Consolidado Referrals Int Alvo', status: 'ATIVO' },
        select: { id: true },
      }),
      prisma.person.create({
        data: { fullName: 'Consolidado Referrals Int Outro', status: 'ATIVO' },
        select: { id: true },
      }),
      prisma.person.create({
        data: { fullName: 'Consolidado Referrals Int Vazio', status: 'ATIVO' },
        select: { id: true },
      }),
    ]);
    targetPersonId = target.id;
    otherPersonId = other.id;
    emptyPersonId = empty.id;

    await prisma.referral.createMany({
      data: [
        {
          id: crypto.randomUUID(),
          personId: targetPersonId,
          jobId,
          referrerPersonId: referrerId,
          justification: 'Perfil aderente',
          createdAt: new Date('2026-06-01T10:00:00Z'),
        },
        {
          id: crypto.randomUUID(),
          personId: targetPersonId,
          jobId,
          referrerPersonId: referrerId,
          justification: null,
          result: 'HIRED',
          resultObservation: 'Contratado após entrevista',
          resultRegisteredBy: referrerId,
          resultRegisteredAt: new Date('2026-07-01T10:00:00Z'),
          createdAt: new Date('2026-06-15T10:00:00Z'),
        },
        // encaminhamento de outra Pessoa — não deve aparecer no escopo do alvo.
        {
          id: crypto.randomUUID(),
          personId: otherPersonId,
          jobId,
          referrerPersonId: referrerId,
          createdAt: new Date('2026-06-20T10:00:00Z'),
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: { in: [authorId, referrerId] } } });
  });

  it('retorna encaminhamento sem resultado e outro com resultado HIRED + observação', async () => {
    const rows = await listPersonReferrals(targetPersonId);
    expect(rows).toHaveLength(2);

    const noResult = rows.find((r) => r.result === null);
    const hired = rows.find((r) => r.result === 'HIRED');
    expect(noResult).toBeDefined();
    expect(noResult?.justification).toBe('Perfil aderente');
    expect(hired).toBeDefined();
    expect(hired?.resultObservation).toBe('Contratado após entrevista');
    expect(hired?.resultRegisteredAt).not.toBeNull();
    expect(hired?.referrerName).toBe('Consolidado Referrals Int Encaminhador');
    expect(hired?.jobTitle).toBe('Vaga Consolidado Referrals Int');
    expect(hired?.companyName).toBe('Consolidado Referrals Int');
  });

  it('escopo personId (Pessoa encaminhada): encaminhamento de outra Pessoa não aparece', async () => {
    const rows = await listPersonReferrals(targetPersonId);
    expect(rows.every((r) => r.jobId === jobId)).toBe(true);
    expect(rows).toHaveLength(2);

    const otherRows = await listPersonReferrals(otherPersonId);
    expect(otherRows).toHaveLength(1);
  });

  it('Pessoa sem encaminhamento → []', async () => {
    const rows = await listPersonReferrals(emptyPersonId);
    expect(rows).toEqual([]);
  });
});
