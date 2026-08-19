import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Teste de integração de `listCompanyRecentApplications` (USP-067 — T5 /
 * PNL-04, A-08 / **PNL-MN-02**). Requer Postgres local (`supabase start`).
 *
 * Cobre: ordenação `appliedAt desc`, `take 5`, escopo por Empresa, e o
 * must-not PNL-MN-02 — o `select` fonte **nunca** menciona `candidate`, e a
 * linha retornada não carrega nenhuma PII do candidato (nome/e-mail/telefone).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { listCompanyRecentApplications } = await import('../queries/list-company-recent-applications');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11444777000253';
const SETOR = 'Recent Applications Int';
const CANDIDATE_NAME = 'Recent Applications Int Candidata PII';
const CANDIDATE_EMAIL = 'recent-app-int-pii@example.com';

skipIfNoDb('listCompanyRecentApplications — integração (T5 / PNL-MN-02)', () => {
  let companyId = '';
  let authorId = '';
  let jobId = '';
  let companyJobIds: string[] = [];

  async function cleanup() {
    await prisma.application.deleteMany({ where: { job: { company: { cnpj: CNPJ } } } });
    await prisma.job.deleteMany({ where: { company: { cnpj: CNPJ } } });
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
    await prisma.person.deleteMany({
      where: { fullName: { startsWith: 'Recent Applications Int' } },
    });
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: 'Recent Applications Int Autor', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        razaoSocial: 'Recent Applications Int Ltda',
        nomeFantasia: 'Recent Applications Int',
        setor: SETOR,
        isVerified: true,
        createdBy: authorId,
      },
      select: { id: true },
    });
    companyId = company.id;

    const job = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga Recent Applications Int', status: 'ACTIVE' },
      select: { id: true },
    });
    jobId = job.id;

    const candidate = await prisma.person.create({
      data: { fullName: CANDIDATE_NAME, emailLogin: CANDIDATE_EMAIL, phone: '48999990000', status: 'ATIVO' },
      select: { id: true },
    });

    // 7 vagas próprias (índice único candidate+job só permite 1 candidatura
    // ativa por par) — todas do mesmo candidato, para o teste de PII (A).
    const otherJobs = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        prisma.job.create({
          data: {
            companyId,
            authorPersonId: authorId,
            title: `Vaga Recent Applications Int Extra ${i}`,
            status: 'ACTIVE',
          },
          select: { id: true },
        }),
      ),
    );
    companyJobIds = [jobId, ...otherJobs.map((j) => j.id)];

    await prisma.application.createMany({
      data: companyJobIds.map((id, i) => ({
        candidatePersonId: candidate.id,
        jobId: id,
        appliedAt: new Date(Date.UTC(2026, 6, 1 + i, 10)),
      })),
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: authorId } });
  });

  it('take 5, ordenado appliedAt desc, escopado à empresa', async () => {
    const rows = await listCompanyRecentApplications(companyId);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => companyJobIds.includes(r.jobId))).toBe(true);

    const dates = rows.map((r) => r.appliedAt.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
    // A mais recente das 7 candidaturas (dia 7) deve ser a primeira.
    expect(rows[0]?.appliedAt.toISOString()).toBe(new Date(Date.UTC(2026, 6, 7, 10)).toISOString());
  });

  it('empresa sem candidaturas → []', async () => {
    const other = await prisma.company.create({
      data: {
        cnpj: '11444777000254',
        razaoSocial: 'Recent Applications Int Vazia Ltda',
        nomeFantasia: 'Recent Applications Int Vazia',
        setor: SETOR,
        isVerified: true,
        createdBy: authorId,
      },
      select: { id: true },
    });

    const rows = await listCompanyRecentApplications(other.id);
    expect(rows).toEqual([]);

    await prisma.company.deleteMany({ where: { id: other.id } });
  });

  it('PNL-MN-02: a linha retornada não contém nenhuma PII do candidato (nome/e-mail/telefone)', async () => {
    const rows = await listCompanyRecentApplications(companyId);
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(['appliedAt', 'jobId', 'jobTitle']);
    }
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain(CANDIDATE_NAME);
    expect(serialized).not.toContain(CANDIDATE_EMAIL);
  });

  it('PNL-MN-02: o `select` fonte não menciona `candidate` (decoy killable — falha se alguém adicionar)', () => {
    const source = readFileSync(
      join(__dirname, '..', 'queries', 'list-company-recent-applications.ts'),
      'utf-8',
    );
    const selectBlock = source.slice(
      source.indexOf('const companyRecentApplicationSelect'),
      source.indexOf('} satisfies Prisma.ApplicationSelect;'),
    );
    expect(selectBlock).not.toMatch(/candidate/i);
  });
});
