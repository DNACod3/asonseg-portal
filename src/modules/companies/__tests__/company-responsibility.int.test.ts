import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Testes de integração do PrismaCompanyResponsibilityAdapter (USP-012 / USP-007).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Valida as três ramificações do adapter:
 *  - pessoa sem grants ativos → retorna []
 *  - pessoa com múltiplos responsáveis → empresa não vira órfã
 *  - pessoa é único responsável → empresa retornada como órfã potencial
 */

const { prisma } = await import('@/shared/lib/prisma');
const { PrismaCompanyResponsibilityAdapter } = await import(
  '../adapters/prisma-company-responsibility'
);

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('PrismaCompanyResponsibilityAdapter — integração', () => {
  let personId = '';
  let person2Id = '';
  let companyAloneId = '';
  let companySharedId = '';
  const adapter = new PrismaCompanyResponsibilityAdapter();

  beforeAll(async () => {
    // Cleanup idempotente: remove dados residuais de runs anteriores.
    for (const cnpj of ['11444777000161', '45997418000153']) {
      const stale = await prisma.company.findUnique({ where: { cnpj }, select: { id: true } });
      if (stale) {
        await prisma.personCompanyGrant.deleteMany({ where: { companyId: stale.id } });
        await prisma.company.delete({ where: { id: stale.id } });
      }
    }

    const [p1, p2] = await Promise.all([
      prisma.person.create({ data: { fullName: 'Resp Int P1', status: 'ATIVO' }, select: { id: true } }),
      prisma.person.create({ data: { fullName: 'Resp Int P2', status: 'ATIVO' }, select: { id: true } }),
    ]);
    personId = p1.id;
    person2Id = p2.id;

    // Empresa onde p1 é o ÚNICO responsável.
    const alone = await prisma.company.create({
      data: {
        cnpj: '11444777000161',
        razaoSocial: 'Empresa Só P1 Ltda',
        nomeFantasia: 'Só P1',
        setor: 'Teste',
        isVerified: false,
        createdBy: personId,
      },
      select: { id: true },
    });
    companyAloneId = alone.id;

    // Empresa onde p1 e p2 são responsáveis.
    const shared = await prisma.company.create({
      data: {
        cnpj: '45997418000153',
        razaoSocial: 'Empresa Compartilhada Ltda',
        nomeFantasia: 'Compartilhada',
        setor: 'Teste',
        isVerified: false,
        createdBy: personId,
      },
      select: { id: true },
    });
    companySharedId = shared.id;

    await Promise.all([
      prisma.personCompanyGrant.create({
        data: { personId, companyId: companyAloneId, grantType: 'RESPONSIBLE', grantedBy: personId },
      }),
      prisma.personCompanyGrant.create({
        data: { personId, companyId: companySharedId, grantType: 'RESPONSIBLE', grantedBy: personId },
      }),
      prisma.personCompanyGrant.create({
        data: { personId: person2Id, companyId: companySharedId, grantType: 'RESPONSIBLE', grantedBy: person2Id },
      }),
    ]);
  });

  afterAll(async () => {
    const ids = [companyAloneId, companySharedId].filter(Boolean);
    if (ids.length > 0) {
      await prisma.personCompanyGrant.deleteMany({ where: { companyId: { in: ids } } });
      await prisma.company.deleteMany({ where: { id: { in: ids } } });
    }
    const pids = [personId, person2Id].filter(Boolean);
    if (pids.length > 0) {
      await prisma.person.deleteMany({ where: { id: { in: pids } } });
    }
  });

  it('pessoa sem grants ativos retorna []', async () => {
    const result = await adapter.companiesLeftWithoutResponsible(person2Id);
    // p2 compartilha empresa com p1 → não há empresa que ficaria órfã.
    expect(result).toEqual([]);
  });

  it('empresa com múltiplos responsáveis não é retornada como órfã', async () => {
    const result = await adapter.companiesLeftWithoutResponsible(personId);
    const ids = result.map((r) => r.id);
    expect(ids).not.toContain(companySharedId);
  });

  it('empresa com único responsável é retornada como potencialmente órfã', async () => {
    const result = await adapter.companiesLeftWithoutResponsible(personId);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const orphan = result.find((r) => r.id === companyAloneId);
    expect(orphan).toMatchObject({ id: companyAloneId, name: 'Empresa Só P1 Ltda' });
  });

  it('grant revogado não conta como responsável ativo', async () => {
    // Revoga o grant de p1 em companySharedId → p2 fica como único responsável lá.
    await prisma.personCompanyGrant.updateMany({
      where: { personId, companyId: companySharedId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Agora p2 é único em companySharedId; mas não é quem estamos testando.
    // p1 só tem companyAloneId ativo → permanece no resultado.
    const result = await adapter.companiesLeftWithoutResponsible(personId);
    const ids = result.map((r) => r.id);
    expect(ids).toContain(companyAloneId);
    expect(ids).not.toContain(companySharedId);
  });
});
