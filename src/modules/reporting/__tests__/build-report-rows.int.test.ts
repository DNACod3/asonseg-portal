import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integração de `buildReportRows` (USP-058 — remediação de exibição sobre a
 * USP-042). Requer Postgres local. Mesma técnica de isolamento das suítes
 * anteriores do módulo (janela fixa e distante, prefixo de nome exclusivo).
 *
 * T2 (REL-2/USP058-01..04/MN-02): R3 resolve o **nome** da categoria de
 * serviço (não o UUID) na projeção única, com "—" para categoria nula/linha
 * sintética de manifestações — sem tocar `report-services.ts`.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { buildReportRows } = await import('../queries/build-report-rows');

const hasDb = Boolean(process.env.DATABASE_URL);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    expect(row!.status).toBe('ACTIVE');
  });

  it('USP058-03: categoryId nulo (rascunho sem categoria) → categoria = "—"', async () => {
    const built = await buildReportRows('services', { from: WINDOW_FROM, to: WINDOW_TO }, dummyViewer);
    const row = built!.rows.find((r) => r.status === 'DRAFT');
    expect(row).toBeDefined();
    expect(row!.categoria).toBe('—');
  });

  it('USP058-03: linha sintética de manifestações (MANIFESTACOES_INTERESSE) → categoria = "—"', async () => {
    const built = await buildReportRows('services', { from: WINDOW_FROM, to: WINDOW_TO }, dummyViewer);
    const row = built!.rows.find((r) => r.status === 'MANIFESTACOES_INTERESSE');
    expect(row).toBeDefined();
    expect(row!.categoria).toBe('—');
  });

  it('USP058-04: a coluna vira {key:"categoria", label:"Categoria"} — não expõe mais "categoryId"', async () => {
    const built = await buildReportRows('services', { from: WINDOW_FROM, to: WINDOW_TO }, dummyViewer);
    expect(built!.columns).toEqual(expect.arrayContaining([{ key: 'categoria', label: 'Categoria' }]));
    expect(built!.columns.some((c) => c.key === 'categoryId')).toBe(false);
  });

  it('MN-02: nenhuma célula de categoria casa com o padrão de UUID cru', async () => {
    const built = await buildReportRows('services', { from: WINDOW_FROM, to: WINDOW_TO }, dummyViewer);
    for (const row of built!.rows) {
      expect(String(row.categoria)).not.toMatch(UUID_PATTERN);
    }
  });

  it('período sem dados (1999) → só a linha de manifestações (edge de período-vazio da USP-042 preservada)', async () => {
    const built = await buildReportRows('services', { from: '1999-01-01', to: '1999-01-31' }, dummyViewer);
    expect(built!.rows).toEqual([{ status: 'MANIFESTACOES_INTERESSE', categoria: '—', count: 0 }]);
  });
});
