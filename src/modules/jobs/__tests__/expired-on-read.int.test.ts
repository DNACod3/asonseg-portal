import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

/**
 * Defesa em profundidade on-read (USP-024 / T3 / P-001, must-not) — confirma que
 * `searchJobs`/`getActiveJobDetail` (USP-021/022, filtro já existente) continuam
 * ocultando uma vaga `ACTIVE` porém com `validUntil` vencido **mesmo que o job de
 * expiração NÃO tenha rodado ainda**. A visibilidade nunca depende só do cron —
 * a query on-read é a fonte da verdade (G2).
 *
 * Requer Postgres local (`supabase start`).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { searchJobs } = await import('../queries/search-jobs');
const { getActiveJobDetail } = await import('../queries/get-job-detail');
const { hojeSaoPaulo } = await import('@/shared/lib/time');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);
const CNPJ = '11444777000320';

/**
 * `days` a partir do dia-calendário de São Paulo (não do relógio local do processo).
 * `hojeSaoPaulo()` já normaliza "hoje" para meia-noite UTC do dia-calendário em SP; a
 * partir daí a aritmética usa `setUTCDate` para permanecer imune ao fuso do runner —
 * evita a janela 21h-00h BRT em que dia-calendário local e UTC divergem (L-006). Crítico
 * aqui: este teste depende de `validUntil` ser estritamente "ontem" em SP.
 */
function dateOffset(days: number): Date {
  const d = hojeSaoPaulo();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

skipIfNoDb('Defesa on-read de vaga vencida — integração (USP-024 / P-001)', () => {
  let authorId = '';
  let companyId = '';

  async function cleanup() {
    await prisma.job.deleteMany({ where: { company: { cnpj: CNPJ } } });
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
  }

  beforeAll(async () => {
    await cleanup();
    const author = await prisma.person.create({ data: { fullName: 'Autor Expired On-Read Int', status: 'ATIVO' }, select: { id: true } });
    authorId = author.id;
  });

  beforeEach(async () => {
    await cleanup();
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Expired On-Read Int Ltda',
        nomeFantasia: 'Expired On-Read Int',
        setor: 'Comércio',
        createdBy: authorId,
        isVerified: true,
      },
      select: { id: true },
    });
    companyId = company.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: authorId } });
  });

  it('P-001: vaga status=ACTIVE porém validUntil vencido (job não rodou) é excluída de searchJobs', async () => {
    const job = await prisma.job.create({
      data: {
        companyId,
        authorPersonId: authorId,
        title: 'Vaga Vencida Não Materializada',
        status: 'ACTIVE', // job de expiração NÃO rodou — status ainda ACTIVE no banco
        validUntil: dateOffset(-1),
        publishedAt: new Date(),
      },
      select: { id: true },
    });

    const result = await searchJobs({}, null);
    expect(result.items.map((i) => i.id)).not.toContain(job.id);
  });

  it('P-001/P-004: vaga status=ACTIVE porém validUntil vencido é excluída do detalhe (getActiveJobDetail → null)', async () => {
    const job = await prisma.job.create({
      data: {
        companyId,
        authorPersonId: authorId,
        title: 'Vaga Vencida Não Materializada Detalhe',
        status: 'ACTIVE',
        validUntil: dateOffset(-1),
        publishedAt: new Date(),
      },
      select: { id: true },
    });

    const detail = await getActiveJobDetail(job.id, null);
    expect(detail).toBeNull(); // página renderiza "vaga encerrada", sem botão candidatar
  });
});
