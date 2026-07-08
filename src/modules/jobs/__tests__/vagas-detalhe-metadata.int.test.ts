import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hojeSaoPaulo } from '@/shared/lib/time';

/**
 * Trava de metadados/JSON-LD do detalhe público (USP-022 / T2 / P-002 / U22-MN-01).
 * Requer Postgres local (`supabase start`).
 *
 * `generateMetadata` (rota `(public)/vagas/[id]/page.tsx`) e o JSON-LD injetado pela página
 * SÃO SEMPRE anônimos — `getActiveJobDetail(id, null)` + `viewJobDetail(row, null)`,
 * independente de quem está autenticado. Este teste semeia uma Empresa **verificada** com
 * nome fantasia real e trava que **nenhum canal** (title, description, Open Graph, Twitter
 * Card, `alternates.canonical`, string do JSON-LD `hiringOrganization`) expõe esse nome
 * real — só o rótulo anonimizado por setor. Cobre também o caso "indisponível" (vaga
 * não-ACTIVE/expirada/Empresa não verificada ⇒ metadados sem dado sensível, `noindex`).
 *
 * O restyle desta USP é só de markup (`VagaIndisponivel`/back-link/container) — a
 * serialização/ISR/metadata em si não foi tocada; este teste é a trava de preservação
 * explícita pedida pela task (reforço de P-002, não redundante com `get-job-detail.int.test.ts`
 * que cobre o on-read, nem com `job-detail.view.spec.ts` que cobre o View Model isolado).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { getActiveJobDetail } = await import('../queries/get-job-detail');
const { viewJobDetail, jobDetailJsonLd, serializeJsonLd } = await import('../views/job-detail.view');
const { generateMetadata } = await import('@/app/(public)/vagas/[id]/page');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ_VERIFIED = '11444777000220';
const CNPJ_UNVERIFIED = '11444777000221';
const SETOR = 'Metadados Int';
const REAL_NAME = 'Empresa Real Metadados Int';

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

skipIfNoDb('vagas/[id] generateMetadata + JSON-LD — integração (P-002/U22-MN-01/U22-MN-03)', () => {
  let authorId = '';
  let verifiedCompanyId = '';
  let unverifiedCompanyId = '';
  let jAtiva = '';
  let jIndisponivel = ''; // ACTIVE persistida mas validade vencida ⇒ getActiveJobDetail = null

  async function cleanup() {
    await prisma.job.deleteMany({
      where: { company: { cnpj: { in: [CNPJ_VERIFIED, CNPJ_UNVERIFIED] } } },
    });
    await prisma.company.deleteMany({
      where: { cnpj: { in: [CNPJ_VERIFIED, CNPJ_UNVERIFIED] } },
    });
    await prisma.person.deleteMany({ where: { fullName: { startsWith: 'Metadados Int' } } });
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: 'Metadados Int Autor', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const verified = await prisma.company.create({
      data: {
        cnpj: CNPJ_VERIFIED,
        razaoSocial: `${REAL_NAME} Ltda`,
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
        razaoSocial: 'Não Verificada Metadados Int Ltda',
        nomeFantasia: 'Não Verificada Metadados Int',
        setor: SETOR,
        isVerified: false,
        createdBy: authorId,
      },
      select: { id: true },
    });
    unverifiedCompanyId = unverified.id;

    const base = {
      authorPersonId: authorId,
      description: 'Descrição da vaga de metadados.',
      requirements: 'Requisitos da vaga de metadados.',
      workRegime: 'Presencial',
      contractType: 'CLT',
    };

    const [a, ind] = await Promise.all([
      prisma.job.create({
        data: {
          ...base,
          companyId: verifiedCompanyId,
          title: 'Vaga Ativa Metadados Int',
          status: 'ACTIVE',
          publishedAt: dateOffset(-1),
          validUntil: dateOffset(30),
        },
        select: { id: true },
      }),
      prisma.job.create({
        data: {
          ...base,
          companyId: unverifiedCompanyId,
          title: 'Vaga Indisponível Metadados Int',
          status: 'ACTIVE',
          publishedAt: dateOffset(-1),
          validUntil: dateOffset(30),
        },
        select: { id: true },
      }),
    ]);
    jAtiva = a.id;
    jIndisponivel = ind.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: authorId } });
  });

  it('U22-MN-01/P-002: nenhum canal de metadados/JSON-LD expõe o nomeFantasia real', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ id: jAtiva }) });

    const channels = [
      String(metadata.title ?? ''),
      String(metadata.description ?? ''),
      JSON.stringify(metadata.openGraph ?? {}),
      JSON.stringify(metadata.twitter ?? {}),
      JSON.stringify(metadata.alternates ?? {}),
    ];
    for (const channel of channels) {
      expect(channel).not.toContain(REAL_NAME);
    }

    // JSON-LD injetado pela página (sempre `viewJobDetail(row, null)`, independe do viewer).
    const row = await getActiveJobDetail(jAtiva, null);
    expect(row).not.toBeNull();
    const jsonLd = serializeJsonLd(jobDetailJsonLd(viewJobDetail(row!, null)));
    expect(jsonLd).not.toContain(REAL_NAME);
    expect(jsonLd).toContain(`Empresa do setor de ${SETOR}`);
  });

  it('U22-MN-03: vaga indetalhável (Empresa não verificada) ⇒ metadados de "indisponível", sem dado sensível', async () => {
    expect(await getActiveJobDetail(jIndisponivel, null)).toBeNull();

    const metadata = await generateMetadata({ params: Promise.resolve({ id: jIndisponivel }) });
    expect(metadata.title).toBe('Vaga indisponível | ASONSEG');
    expect(metadata.robots).toMatchObject({ index: false });
    expect(JSON.stringify(metadata)).not.toContain('Não Verificada Metadados Int');
  });
});
