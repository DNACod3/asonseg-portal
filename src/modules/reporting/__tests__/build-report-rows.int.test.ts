import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integração de `buildReportRows` (USP-058 — remediação de exibição sobre a
 * USP-042). Requer Postgres local. Mesma técnica de isolamento das suítes
 * anteriores do módulo (janela fixa e distante, prefixo de nome exclusivo).
 *
 * T2 (REL-2/USP058-01..04/MN-02): R3 resolve o **nome** da categoria de
 * serviço (não o UUID) na projeção única, com "—" para categoria nula/linha
 * sintética de manifestações — sem tocar `report-services.ts`.
 *
 * T3 (REL-3/USP058-11..15/MN-01): status (R1/R3), marcador de manifestações
 * (R3) e dimensões de renda/moradia (R6 full) em rótulo PT-BR canônico —
 * nunca o token cru do enum. As expectativas usam os literais PT-BR
 * (spec-anchored), não reimportam `labelContentStatus`, para não tautologizar
 * contra o próprio mapa sob teste.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { buildReportRows } = await import('../queries/build-report-rows');

const hasDb = Boolean(process.env.DATABASE_URL);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RAW_ENUM_TOKENS = ['ACTIVE', 'DRAFT', 'IN_MODERATION', 'MANIFESTACOES_INTERESSE', 'UP_TO_1_MW', 'RENTED'];

const dummyViewer = { roles: [] as readonly string[], id: 'viewer-dummy', ip: null, userAgent: null };

describe.skipIf(!hasDb)('USP-058/T2 — buildReportRows("services") resolve nome de categoria (REL-2)', () => {
  const NAME_PREFIX = 'BuildRowsSvcInt';
  const CAT_NAME = `${NAME_PREFIX} Categoria Elétrica`;
  const WINDOW_FROM = '2019-08-01';
  const WINDOW_TO = '2019-08-31';
  const INSIDE_DATE = new Date('2019-08-15T12:00:00Z');

  let category: { id: string };

  async function cleanup(): Promise<void> {
    await prisma.serviceInterest.deleteMany({ where: { service: { title: { startsWith: NAME_PREFIX } } } });
    await prisma.service.deleteMany({ where: { title: { startsWith: NAME_PREFIX } } });
    await prisma.serviceCategory.deleteMany({ where: { name: CAT_NAME } });
    await prisma.person.deleteMany({ where: { fullName: { startsWith: NAME_PREFIX } } });
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Author`, status: 'ATIVO' },
      select: { id: true },
    });
    category = await prisma.serviceCategory.create({ data: { name: CAT_NAME }, select: { id: true } });

    await prisma.service.create({
      data: {
        authorPersonId: author.id,
        categoryId: category.id,
        title: `${NAME_PREFIX} Com categoria`,
        status: 'ACTIVE',
        createdAt: INSIDE_DATE,
      },
    });
    // Rascunho sem categoria (categoryId null) — USP058-03.
    await prisma.service.create({
      data: {
        authorPersonId: author.id,
        categoryId: null,
        title: `${NAME_PREFIX} Sem categoria`,
        status: 'DRAFT',
        createdAt: INSIDE_DATE,
      },
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it('USP058-01/02: célula "categoria" da linha ACTIVE é o NOME da ServiceCategory, não o UUID', async () => {
    const built = await buildReportRows('services', { from: WINDOW_FROM, to: WINDOW_TO }, dummyViewer);
    expect(built).not.toBeNull();
    const row = built!.rows.find((r) => r.categoria === CAT_NAME);
    expect(row).toBeDefined();
    expect(row!.categoria).toBe(CAT_NAME);
  });

  it('USP058-11: status ACTIVE → "Ativo", DRAFT → "Rascunho" (PT-BR, nunca o token)', async () => {
    const built = await buildReportRows('services', { from: WINDOW_FROM, to: WINDOW_TO }, dummyViewer);
    const activeRow = built!.rows.find((r) => r.categoria === CAT_NAME);
    expect(activeRow!.status).toBe('Ativo');
    const draftRow = built!.rows.find((r) => r.categoria === '—' && r.count === 1);
    expect(draftRow!.status).toBe('Rascunho');
  });

  it('USP058-03: categoryId nulo (rascunho sem categoria) → categoria = "—"', async () => {
    const built = await buildReportRows('services', { from: WINDOW_FROM, to: WINDOW_TO }, dummyViewer);
    const row = built!.rows.find((r) => r.status === 'Rascunho');
    expect(row).toBeDefined();
    expect(row!.categoria).toBe('—');
  });

  it('USP058-03/12: linha sintética de manifestações → categoria = "—", status = "Manifestações de interesse"', async () => {
    const built = await buildReportRows('services', { from: WINDOW_FROM, to: WINDOW_TO }, dummyViewer);
    const row = built!.rows.find((r) => r.status === 'Manifestações de interesse');
    expect(row).toBeDefined();
    expect(row!.categoria).toBe('—');
  });

  it('USP058-04: a coluna vira {key:"categoria", label:"Categoria"} — não expõe mais "categoryId"', async () => {
    const built = await buildReportRows('services', { from: WINDOW_FROM, to: WINDOW_TO }, dummyViewer);
    expect(built!.columns).toEqual(expect.arrayContaining([{ key: 'categoria', label: 'Categoria' }]));
    expect(built!.columns.some((c) => c.key === 'categoryId')).toBe(false);
  });

  it('MN-01/MN-02: nenhuma célula de status/categoria contém token cru do enum ou UUID', async () => {
    const built = await buildReportRows('services', { from: WINDOW_FROM, to: WINDOW_TO }, dummyViewer);
    for (const row of built!.rows) {
      expect(String(row.categoria)).not.toMatch(UUID_PATTERN);
      expect(RAW_ENUM_TOKENS).not.toContain(String(row.status));
      expect(RAW_ENUM_TOKENS).not.toContain(String(row.categoria));
    }
  });

  it('período sem dados (1999) → só a linha de manifestações, com o rótulo PT-BR (edge de período-vazio preservada)', async () => {
    const built = await buildReportRows('services', { from: '1999-01-01', to: '1999-01-31' }, dummyViewer);
    expect(built!.rows).toEqual([{ status: 'Manifestações de interesse', categoria: '—', count: 0 }]);
  });
});

describe.skipIf(!hasDb)('USP-058/T3 — buildReportRows("jobs") rótulos PT-BR de status (REL-3)', () => {
  const NAME_PREFIX = 'BuildRowsJobsInt';
  const CNPJ = '91000058000106';
  const WINDOW_FROM = '2019-09-01';
  const WINDOW_TO = '2019-09-30';
  const INSIDE_DATE = new Date('2019-09-15T12:00:00Z');

  async function cleanup(): Promise<void> {
    await prisma.job.deleteMany({ where: { company: { cnpj: CNPJ } } });
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
    await prisma.person.deleteMany({ where: { fullName: { startsWith: NAME_PREFIX } } });
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Author`, status: 'ATIVO' },
      select: { id: true },
    });
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        razaoSocial: `${NAME_PREFIX} Ltda`,
        nomeFantasia: NAME_PREFIX,
        setor: 'Tecnologia',
        createdBy: author.id,
      },
      select: { id: true },
    });
    await prisma.job.createMany({
      data: [
        { companyId: company.id, authorPersonId: author.id, title: `${NAME_PREFIX} V1`, status: 'ACTIVE', createdAt: INSIDE_DATE },
        { companyId: company.id, authorPersonId: author.id, title: `${NAME_PREFIX} V2`, status: 'IN_MODERATION', createdAt: INSIDE_DATE },
      ],
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it('USP058-11: ACTIVE → "Ativo", IN_MODERATION → "Em moderação" (nunca o token cru)', async () => {
    const built = await buildReportRows('jobs', { from: WINDOW_FROM, to: WINDOW_TO }, dummyViewer);
    const statuses = built!.rows.map((r) => r.status);
    expect(statuses).toContain('Ativo');
    expect(statuses).toContain('Em moderação');
    for (const status of statuses) {
      expect(RAW_ENUM_TOKENS).not.toContain(String(status));
    }
  });
});

describe.skipIf(!hasDb)('USP-058/T3 — buildReportRows("social", full) rótulos PT-BR de renda/moradia (REL-3)', () => {
  const NAME_PREFIX = 'BuildRowsSocialInt';
  const REGION_NAME = `${NAME_PREFIX} Região`;

  let region: { id: string };
  let asPersonId: string;

  async function cleanup(): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL app.audit_purge = 'on'");
      await tx.$executeRawUnsafe(
        `DELETE FROM audit_log WHERE context ->> 'via' = 'social_report' AND actor_person_id IN (SELECT id FROM persons WHERE full_name LIKE '${NAME_PREFIX}%')`,
      );
    });
    await prisma.socioeconomicRecord.deleteMany({ where: { person: { fullName: { startsWith: NAME_PREFIX } } } });
    await prisma.candidateProfile.deleteMany({ where: { person: { fullName: { startsWith: NAME_PREFIX } } } });
    await prisma.person.deleteMany({ where: { fullName: { startsWith: NAME_PREFIX } } });
    await prisma.region.deleteMany({ where: { name: REGION_NAME } });
  }

  beforeAll(async () => {
    await cleanup();

    region = await prisma.region.create({
      data: { name: REGION_NAME, cityName: 'Cidade Teste', state: 'SC' },
      select: { id: true },
    });

    const target = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Titular`, status: 'ATIVO' },
      select: { id: true },
    });
    await prisma.candidateProfile.create({ data: { personId: target.id, regionId: region.id } });
    await prisma.socioeconomicRecord.create({
      data: { personId: target.id, incomeBracket: 'UP_TO_1_MW', housingSituation: 'RENTED' },
    });

    const asActor = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} AS Actor`, status: 'ATIVO' },
      select: { id: true },
    });
    asPersonId = asActor.id;
  });

  afterAll(async () => {
    await cleanup();
  });

  it('USP058-13: renda UP_TO_1_MW → "Até 1 salário mínimo", moradia RENTED → "Alugada" (nunca o token cru)', async () => {
    const built = await buildReportRows(
      'social',
      { regionId: region.id },
      { roles: ['SOCIAL_ASSISTANT'], id: asPersonId, ip: null, userAgent: null },
    );
    expect(built).not.toBeNull();
    const categorias = built!.rows.map((r) => r.categoria);
    expect(categorias).toContain('Até 1 salário mínimo');
    expect(categorias).toContain('Alugada');
    for (const categoria of categorias) {
      expect(RAW_ENUM_TOKENS).not.toContain(String(categoria));
    }
  });
});
