import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Testes de integração da migration de status do vínculo (USP-013 / T1).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Cobre os facts:
 *  - P-004 (`@ac-p-004`): UNIQUE parcial `(person_id, company_id) WHERE revoked_at IS NULL`
 *    impede 2º vínculo não-removido (PENDING/ACTIVE) da mesma Pessoa↔Empresa (P2002),
 *    mas permite re-vínculo após remoção (revoked_at != null fica fora do índice).
 *  - status legado: grant criado sem `status` explícito assume ACTIVE (default da migration).
 *  - invariante "≥1 responsável ativo" conta apenas status=ACTIVE: um vínculo PENDING
 *    não conta como responsável (não torna a Empresa "não-órfã").
 */

const { prisma } = await import('@/shared/lib/prisma');
const { PrismaCompanyResponsibilityAdapter } = await import(
  '../adapters/prisma-company-responsibility'
);

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('USP-013 T1 — status do vínculo + UNIQUE parcial', () => {
  let personId = '';
  let pendingPersonId = '';
  let companyId = '';
  const adapter = new PrismaCompanyResponsibilityAdapter();

  beforeAll(async () => {
    const stale = await prisma.company.findUnique({
      where: { cnpj: '19131243000197' },
      select: { id: true },
    });
    if (stale) {
      await prisma.personCompanyGrant.deleteMany({ where: { companyId: stale.id } });
      await prisma.company.delete({ where: { id: stale.id } });
    }

    const [p1, p2] = await Promise.all([
      prisma.person.create({ data: { fullName: 'Grant Status P1', status: 'ATIVO' }, select: { id: true } }),
      prisma.person.create({ data: { fullName: 'Grant Status Pend', status: 'ATIVO' }, select: { id: true } }),
    ]);
    personId = p1.id;
    pendingPersonId = p2.id;

    const company = await prisma.company.create({
      data: {
        cnpj: '19131243000197',
        razaoSocial: 'Empresa Status Ltda',
        nomeFantasia: 'Status',
        setor: 'Teste',
        isVerified: false,
        createdBy: personId,
      },
      select: { id: true },
    });
    companyId = company.id;
  });

  afterAll(async () => {
    if (companyId) {
      await prisma.personCompanyGrant.deleteMany({ where: { companyId } });
      await prisma.company.deleteMany({ where: { id: companyId } });
    }
    const pids = [personId, pendingPersonId].filter(Boolean);
    if (pids.length > 0) {
      await prisma.person.deleteMany({ where: { id: { in: pids } } });
    }
  });

  it('grant criado sem status explícito assume ACTIVE (default da migration)', async () => {
    const grant = await prisma.personCompanyGrant.create({
      data: { personId, companyId, grantType: 'RESPONSIBLE', grantedBy: personId },
      select: { status: true },
    });
    expect(grant.status).toBe('ACTIVE');
  });

  it('@ac-p-004 — bloqueia 2º vínculo não-removido da mesma Pessoa↔Empresa (UNIQUE parcial)', async () => {
    // p1 já tem um vínculo ACTIVE (criado no teste anterior). Um 2º não-removido viola o índice.
    await expect(
      prisma.personCompanyGrant.create({
        data: {
          personId,
          companyId,
          grantType: 'RESPONSIBLE',
          grantedBy: personId,
          status: 'PENDING',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('@ac-p-004 — permite re-vínculo após remoção (revoked_at fica fora do índice)', async () => {
    await prisma.personCompanyGrant.updateMany({
      where: { personId, companyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const novo = await prisma.personCompanyGrant.create({
      data: { personId, companyId, grantType: 'RESPONSIBLE', grantedBy: personId, status: 'ACTIVE' },
      select: { id: true, status: true },
    });
    expect(novo.status).toBe('ACTIVE');
  });

  it('invariante "≥1 responsável ativo" não conta vínculo PENDING', async () => {
    // Estado atual: p1 tem 1 grant ACTIVE em companyId (único responsável ativo).
    // Adiciona um vínculo PENDING de pendingPersonId — NÃO deve "salvar" a Empresa
    // da orfandade, pois PENDING não conta como responsável ativo.
    await prisma.personCompanyGrant.create({
      data: {
        personId: pendingPersonId,
        companyId,
        grantType: 'RESPONSIBLE',
        grantedBy: personId,
        status: 'PENDING',
        pendingAt: new Date(),
      },
    });

    const result = await adapter.companiesLeftWithoutResponsible(personId);
    const ids = result.map((r) => r.id);
    // p1 ainda é o único responsável ACTIVE → Empresa segue como potencialmente órfã.
    expect(ids).toContain(companyId);
  });
});
