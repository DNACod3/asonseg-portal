import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';
import { hojeSaoPaulo } from '@/shared/lib/time';

/**
 * Testes de integração da query de detalhe `getActiveJobDetail` (USP-022 / #173).
 * Requer Postgres local (`supabase start`).
 *
 * Real: Prisma/Postgres. Cobre o filtro on-read que torna a vaga "detalhável"
 * (E-005/P-004/P-005 — espelha `searchJobs`): vaga não-ACTIVE, expirada ou de Empresa
 * não verificada ⇒ `null` (a página renderiza "vaga encerrada", não 404). Cobre também a
 * contagem de candidaturas ativas (E-003) e a projeção condicional do nome real (P-002).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { getActiveJobDetail } = await import('../queries/get-job-detail');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ_VERIFIED = '11444777000210';
const CNPJ_UNVERIFIED = '11444777000211';
const SETOR = 'Detalhe Int';
const REAL_NAME = 'Verificada Detalhe Int';

/**
 * `days` a partir do dia-calendário de São Paulo (não do relógio local do processo).
 * `hojeSaoPaulo()` já normaliza "hoje" para meia-noite UTC do dia-calendário em SP; a
 * partir daí a aritmética usa `setUTCDate` para permanecer imune ao fuso do runner —
 * evita a janela 21h-00h BRT em que dia-calendário local e UTC divergem (L-006).
 */
function dateOffset(days: number): Date {
  const d = hojeSaoPaulo();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const anon: CurrentPerson | null = null;
const authenticated: CurrentPerson = {
  id: 'will-be-set',
  supabaseUserId: '00000000-0000-0000-0000-000000000010',
  fullName: 'Maria',
  status: 'ATIVO',
  primeiroAcesso: false,
  roles: ['CANDIDATE'],
  phone: null,
  fullAddress: null,
};

skipIfNoDb('getActiveJobDetail — integração', () => {
  let authorId = '';
  let verifiedCompanyId = '';
  let unverifiedCompanyId = '';

  let jAtiva = ''; // ACTIVE, verificada, válida, 3 candidaturas ativas + 1 cancelada
  let jExpirada = ''; // ACTIVE mas validUntil no passado (P-004)
  let jModeracao = ''; // IN_MODERATION (E-005)
  let jNaoVerificada = ''; // ACTIVE válida mas Empresa não verificada (P-005)
  let jInativada = ''; // INACTIVATED pelo coordenador (USP-018 / INACT-MN-04)

  async function cleanup() {
    await prisma.application.deleteMany({
      where: { job: { company: { cnpj: { in: [CNPJ_VERIFIED, CNPJ_UNVERIFIED] } } } },
    });
    await prisma.job.deleteMany({
      where: { company: { cnpj: { in: [CNPJ_VERIFIED, CNPJ_UNVERIFIED] } } },
    });
    await prisma.company.deleteMany({
      where: { cnpj: { in: [CNPJ_VERIFIED, CNPJ_UNVERIFIED] } },
    });
    await prisma.person.deleteMany({ where: { fullName: { startsWith: 'Detalhe Int' } } });
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: 'Detalhe Int Autor', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const verified = await prisma.company.create({
      data: {
        cnpj: CNPJ_VERIFIED,
        razaoSocial: 'Verificada Detalhe Int Ltda',
        nomeFantasia: REAL_NAME,
        setor: SETOR,
        isVerified: true,
        createdBy: authorId,
      },
      select: { id: true },
    });
    verifiedCompanyId = verified.id;

    const unverified = await prisma.company.create({
      data: {
        cnpj: CNPJ_UNVERIFIED,
        razaoSocial: 'Não Verificada Detalhe Int Ltda',
        nomeFantasia: 'Não Verificada Detalhe Int',
        setor: SETOR,
        isVerified: false,
        createdBy: authorId,
      },
      select: { id: true },
    });
    unverifiedCompanyId = unverified.id;

    const base = {
      authorPersonId: authorId,
      description: 'Descrição do detalhe.',
      requirements: 'Requisitos do detalhe.',
      benefits: 'Benefícios do detalhe.',
      workRegime: 'Presencial',
      contractType: 'CLT',
      salaryMin: 2000,
      salaryMax: 3000,
      salaryVisible: true,
    };

    const [a, e, m, nv, ina] = await Promise.all([
      prisma.job.create({
        data: { ...base, companyId: verifiedCompanyId, title: 'Vaga Ativa Detalhe', status: 'ACTIVE', publishedAt: dateOffset(-1), validUntil: dateOffset(30) },
        select: { id: true },
      }),
      prisma.job.create({
        data: { ...base, companyId: verifiedCompanyId, title: 'Vaga Expirada Detalhe', status: 'ACTIVE', publishedAt: dateOffset(-10), validUntil: dateOffset(-1) },
        select: { id: true },
      }),
      prisma.job.create({
        data: { ...base, companyId: verifiedCompanyId, title: 'Vaga Moderação Detalhe', status: 'IN_MODERATION', validUntil: dateOffset(30) },
        select: { id: true },
      }),
      prisma.job.create({
        data: { ...base, companyId: unverifiedCompanyId, title: 'Vaga Não Verificada Detalhe', status: 'ACTIVE', publishedAt: dateOffset(-1), validUntil: dateOffset(30) },
        select: { id: true },
      }),
      prisma.job.create({
        data: { ...base, companyId: verifiedCompanyId, title: 'Vaga Inativada Detalhe', status: 'INACTIVATED', publishedAt: dateOffset(-1), validUntil: dateOffset(30) },
        select: { id: true },
      }),
    ]);
    jAtiva = a.id;
    jExpirada = e.id;
    jModeracao = m.id;
    jNaoVerificada = nv.id;
    jInativada = ina.id;

    // 3 candidaturas ativas + 1 cancelada na vaga ativa.
    const candidatos = await Promise.all(
      [1, 2, 3, 4].map((i) =>
        prisma.person.create({
          data: { fullName: `Detalhe Int Candidato ${i}`, status: 'ATIVO' },
          select: { id: true },
        }),
      ),
    );
    await prisma.application.createMany({
      data: [
        { candidatePersonId: candidatos[0]!.id, jobId: jAtiva, cancelledAt: null },
        { candidatePersonId: candidatos[1]!.id, jobId: jAtiva, cancelledAt: null },
        { candidatePersonId: candidatos[2]!.id, jobId: jAtiva, cancelledAt: null },
        { candidatePersonId: candidatos[3]!.id, jobId: jAtiva, cancelledAt: new Date() },
      ],
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: authorId } });
  });

  it('@e-005 @p-004 @p-005 vaga não-ACTIVE / expirada / Empresa não verificada ⇒ null', async () => {
    expect(await getActiveJobDetail(jExpirada, anon)).toBeNull();
    expect(await getActiveJobDetail(jModeracao, anon)).toBeNull();
    expect(await getActiveJobDetail(jNaoVerificada, anon)).toBeNull();
    expect(await getActiveJobDetail('00000000-0000-0000-0000-0000000000ff', anon)).toBeNull();
  });

  it('@usp-018 @inact-mn-04 vaga INACTIVATED retorna null (nunca detalhável)', async () => {
    expect(await getActiveJobDetail(jInativada, anon)).toBeNull();
    expect(await getActiveJobDetail(jInativada, authenticated)).toBeNull();
  });

  it('@e-003 conta candidaturas ativas ignorando as canceladas', async () => {
    const row = await getActiveJobDetail(jAtiva, anon);
    expect(row?.applicationCount).toBe(3);
  });

  it('@p-002 anônimo não carrega o nome real (nomeFantasia) da Empresa', async () => {
    const row = await getActiveJobDetail(jAtiva, anon);
    expect(row).not.toBeNull();
    expect(row?.company.nomeFantasia).toBeUndefined();
    expect(row?.company.setor).toBe(SETOR);
    expect(JSON.stringify(row)).not.toContain(REAL_NAME);
  });

  it('@e-002 autenticado carrega o nome real da Empresa', async () => {
    const row = await getActiveJobDetail(jAtiva, authenticated);
    expect(row?.company.nomeFantasia).toBe(REAL_NAME);
  });
});
