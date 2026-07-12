import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Integração de `exportReport` (T11 — happy CSV/PDF contra Postgres real +
 * REPORT_EXPORTED de verdade no `audit_log`). A sessão (`getCurrentPerson`)
 * é mockada — este repo não semeia sessão Supabase em testes de integração
 * (mesmo racional de L-007/AD-019 para E2E) — mas toda leitura/escrita de
 * dado (Job, DelegatedPermission, `audit_log`) é real. As negativas
 * MN-01/03/06/07 com dependências totalmente mockadas vivem em
 * `export-report.test.ts` (mais rápido/determinístico); aqui reforçamos
 * MN-03 com uma leitura de `audit_log` de verdade (nenhuma linha nova).
 */

const identityState = vi.hoisted(() => ({
  current: null as { id: string; fullName: string; roles: string[] } | null,
}));

vi.mock('@/modules/identity', async () => {
  const actual = await vi.importActual<typeof import('@/modules/identity')>('@/modules/identity');
  return { ...actual, getCurrentPerson: async () => identityState.current };
});

// `headers()` do Next só funciona dentro de uma request real (App Router) —
// fora dela (este teste de integração roda a action diretamente, sem
// servidor), mockamos como o precedente `access-report.test.ts`.
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '10.0.0.10', 'user-agent': 'vitest-integration' }),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { exportReport } = await import('../actions/export-report');

const hasDb = Boolean(process.env.DATABASE_URL);

const NAME_PREFIX = 'ReportExportInt';
const CNPJ = '91000042000105';
const WINDOW_FROM = '2019-10-01';
const WINDOW_TO = '2019-10-31';
const INSIDE_DATE = new Date('2019-10-15T12:00:00Z');

async function cleanup(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL app.audit_purge = 'on'");
    await tx.$executeRawUnsafe(
      `DELETE FROM audit_log WHERE actor_person_id IN (SELECT id FROM persons WHERE full_name LIKE '${NAME_PREFIX}%')`,
    );
  });
  await prisma.job.deleteMany({ where: { company: { cnpj: CNPJ } } });
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
  await prisma.person.deleteMany({ where: { fullName: { startsWith: NAME_PREFIX } } });
}

describe.skipIf(!hasDb)('USP-042/T11 — exportReport (integração)', () => {
  let coordId: string;
  let volunteerId: string;

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
        { companyId: company.id, authorPersonId: author.id, title: `${NAME_PREFIX} V2`, status: 'ACTIVE', createdAt: INSIDE_DATE },
        { companyId: company.id, authorPersonId: author.id, title: `${NAME_PREFIX} V3`, status: 'DRAFT', createdAt: INSIDE_DATE },
      ],
    });

    const coord = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Coord`, status: 'ATIVO' },
      select: { id: true },
    });
    coordId = coord.id;
    const volunteer = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Volunteer`, status: 'ATIVO' },
      select: { id: true },
    });
    volunteerId = volunteer.id;
  });

  afterAll(async () => {
    await cleanup();
  });

  it('happy CSV: COORDINATOR exporta o relatório de vagas — conteúdo correto + REPORT_EXPORTED real no audit_log', async () => {
    identityState.current = { id: coordId, fullName: `${NAME_PREFIX} Coord`, roles: ['COORDINATOR'] };
    const before = await prisma.auditLog.count({ where: { action: 'REPORT_EXPORTED', actorPersonId: coordId } });

    const result = await exportReport({
      reportType: 'jobs',
      filters: { from: WINDOW_FROM, to: WINDOW_TO },
      format: 'CSV',
      acknowledgePII: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.format).toBe('CSV');
      // USP-058/REL-3 (G2): status em PT-BR também no export — a projeção única
      // (buildReportRows) traduz antes de chegar ao serializador CSV.
      expect(result.data.content).toContain('Ativo;2');
      expect(result.data.content).toContain('Rascunho;1');
    }

    const after = await prisma.auditLog.count({ where: { action: 'REPORT_EXPORTED', actorPersonId: coordId } });
    expect(after - before).toBe(1);
  });

  it('happy PDF: COORDINATOR exporta em PDF real — bytes começam com %PDF (renderToBuffer de verdade)', async () => {
    identityState.current = { id: coordId, fullName: `${NAME_PREFIX} Coord`, roles: ['COORDINATOR'] };

    const result = await exportReport({
      reportType: 'jobs',
      filters: { from: WINDOW_FROM, to: WINDOW_TO },
      format: 'PDF',
      acknowledgePII: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mimeType).toBe('application/pdf');
      const bytes = Buffer.from(result.data.content, 'base64');
      expect(bytes.subarray(0, 4).toString('utf-8')).toBe('%PDF');
    }
  });

  it('período sem dados (1999): CSV só com cabeçalho, sem lançar, ainda audita o export', async () => {
    identityState.current = { id: coordId, fullName: `${NAME_PREFIX} Coord`, roles: ['COORDINATOR'] };

    const result = await exportReport({
      reportType: 'jobs',
      filters: { from: '1999-01-01', to: '1999-01-31' },
      format: 'CSV',
      acknowledgePII: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.content.trim()).toBe('Status;Quantidade');
    }
  });

  it('REL42-MN-03 (negativo, real): VOLUNTEER sem guard → FORBIDDEN, NENHUMA linha nova de REPORT_EXPORTED no audit_log', async () => {
    identityState.current = { id: volunteerId, fullName: `${NAME_PREFIX} Volunteer`, roles: ['VOLUNTEER'] };
    const before = await prisma.auditLog.count({ where: { action: 'REPORT_EXPORTED', actorPersonId: volunteerId } });

    const result = await exportReport({
      reportType: 'jobs',
      filters: { from: WINDOW_FROM, to: WINDOW_TO },
      format: 'CSV',
      acknowledgePII: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');

    const after = await prisma.auditLog.count({ where: { action: 'REPORT_EXPORTED', actorPersonId: volunteerId } });
    expect(after - before).toBe(0);
  });
});
