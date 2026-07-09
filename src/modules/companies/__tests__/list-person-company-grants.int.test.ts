import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Testes de integração de `listPersonCompanyGrants` (USP-039 / T5 — dimensão
 * "papéis organizacionais" do painel consolidado). Requer Postgres local
 * (`supabase start`). Exercita o `where: { personId, revokedAt: null }` real
 * (direção inversa de `listActiveResponsibles` — lição AD-021).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { listPersonCompanyGrants } = await import('../queries/list-person-company-grants');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ_A = '11444777000270';
const CNPJ_B = '11444777000271';
const SETOR = 'Vinculos Consolidado Int';

skipIfNoDb('listPersonCompanyGrants — integração', () => {
  let companyAId = '';
  let companyBId = '';
  let targetPersonId = '';
  let otherPersonId = '';
  let emptyPersonId = '';

  async function cleanup() {
    await prisma.personCompanyGrant.deleteMany({ where: { company: { cnpj: { in: [CNPJ_A, CNPJ_B] } } } });
    await prisma.company.deleteMany({ where: { cnpj: { in: [CNPJ_A, CNPJ_B] } } });
    await prisma.person.deleteMany({ where: { fullName: { startsWith: 'Consolidado Grants Int' } } });
  }

  beforeAll(async () => {
    await cleanup();

    const [target, other, empty] = await Promise.all([
      prisma.person.create({
        data: { fullName: 'Consolidado Grants Int Alvo', status: 'ATIVO' },
        select: { id: true },
      }),
      prisma.person.create({
        data: { fullName: 'Consolidado Grants Int Outro', status: 'ATIVO' },
        select: { id: true },
      }),
      prisma.person.create({
        data: { fullName: 'Consolidado Grants Int Vazio', status: 'ATIVO' },
        select: { id: true },
      }),
    ]);
    targetPersonId = target.id;
    otherPersonId = other.id;
    emptyPersonId = empty.id;

    const [companyA, companyB] = await Promise.all([
      prisma.company.create({
        data: {
          cnpj: CNPJ_A,
          razaoSocial: 'Consolidado Grants Int Ltda A',
          nomeFantasia: 'Consolidado Grants Int A',
          setor: SETOR,
          isVerified: true,
          createdBy: targetPersonId,
        },
        select: { id: true },
      }),
      prisma.company.create({
        data: {
          cnpj: CNPJ_B,
          razaoSocial: 'Consolidado Grants Int Ltda B',
          nomeFantasia: 'Consolidado Grants Int B',
          setor: SETOR,
          isVerified: true,
          createdBy: targetPersonId,
        },
        select: { id: true },
      }),
    ]);
    companyAId = companyA.id;
    companyBId = companyB.id;

    await prisma.personCompanyGrant.createMany({
      data: [
        // Vínculo ATIVO do alvo com a Empresa A.
        {
          personId: targetPersonId,
          companyId: companyAId,
          grantType: 'RESPONSIBLE',
          status: 'ACTIVE',
          grantedBy: targetPersonId,
          grantedAt: new Date('2026-06-01T10:00:00Z'),
          acceptedAt: new Date('2026-06-01T10:00:00Z'),
        },
        // Vínculo PENDING do alvo com a Empresa B.
        {
          personId: targetPersonId,
          companyId: companyBId,
          grantType: 'RESPONSIBLE',
          status: 'PENDING',
          grantedBy: targetPersonId,
          grantedAt: new Date('2026-07-01T10:00:00Z'),
          pendingAt: new Date('2026-07-01T10:00:00Z'),
        },
        // Vínculo REVOGADO do alvo com a Empresa A — não deve aparecer.
        {
          personId: targetPersonId,
          companyId: companyAId,
          grantType: 'RESPONSIBLE',
          status: 'ACTIVE',
          grantedBy: targetPersonId,
          grantedAt: new Date('2026-05-01T10:00:00Z'),
          revokedAt: new Date('2026-05-15T10:00:00Z'),
          revokedBy: targetPersonId,
        },
        // Vínculo de outra Pessoa — não deve aparecer no escopo do alvo.
        {
          personId: otherPersonId,
          companyId: companyAId,
          grantType: 'RESPONSIBLE',
          status: 'ACTIVE',
          grantedBy: otherPersonId,
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it('retorna vínculo ATIVO e PENDING do alvo, com `status` correto', async () => {
    const rows = await listPersonCompanyGrants(targetPersonId);
    expect(rows).toHaveLength(2);

    const active = rows.find((r) => r.companyId === companyAId);
    const pending = rows.find((r) => r.companyId === companyBId);
    expect(active?.status).toBe('ACTIVE');
    expect(active?.companyName).toBe('Consolidado Grants Int A');
    expect(pending?.status).toBe('PENDING');
    expect(pending?.companyName).toBe('Consolidado Grants Int B');
  });

  it('vínculo revogado (revokedAt != null) não aparece', async () => {
    const rows = await listPersonCompanyGrants(targetPersonId);
    // Só 2 vínculos vivos — o terceiro (revogado) da Empresa A está fora.
    expect(rows.filter((r) => r.companyId === companyAId)).toHaveLength(1);
  });

  it('escopo personId: vínculo de outra Pessoa não aparece', async () => {
    const rows = await listPersonCompanyGrants(targetPersonId);
    expect(rows.every((r) => r.grantId !== undefined)).toBe(true);
    expect(rows).toHaveLength(2);

    const otherRows = await listPersonCompanyGrants(otherPersonId);
    expect(otherRows).toHaveLength(1);
    expect(otherRows[0]?.companyId).toBe(companyAId);
  });

  it('Pessoa sem vínculo → []', async () => {
    const rows = await listPersonCompanyGrants(emptyPersonId);
    expect(rows).toEqual([]);
  });
});
