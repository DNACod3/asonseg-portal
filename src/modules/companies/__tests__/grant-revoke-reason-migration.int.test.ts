import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Teste de integração da migration `revoke_reason` (USP-014 / T2).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Cobre os facts:
 *  - coluna `revoke_reason` existe e é nullable (default NULL quando não informada);
 *  - completa o trio quando/quem/porquê na própria linha (revokedAt/revokedBy/revokeReason).
 */

const { prisma } = await import('@/shared/lib/prisma');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('USP-014 T2 — coluna revoke_reason', () => {
  let personId = '';
  let companyId = '';

  beforeAll(async () => {
    const stale = await prisma.company.findUnique({
      where: { cnpj: 'usp014t2-29979036000140' },
      select: { id: true },
    });
    if (stale) {
      await prisma.personCompanyGrant.deleteMany({ where: { companyId: stale.id } });
      await prisma.company.delete({ where: { id: stale.id } });
    }

    const person = await prisma.person.create({
      data: { fullName: 'Revoke Reason P1', status: 'ATIVO' },
      select: { id: true },
    });
    personId = person.id;

    const company = await prisma.company.create({
      data: {
        cnpj: 'usp014t2-29979036000140',
        razaoSocial: 'Empresa Revoke Reason Ltda',
        nomeFantasia: 'RevokeReason',
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
    if (personId) {
      await prisma.person.deleteMany({ where: { id: personId } });
    }
  });

  it('grant criado sem revokeReason fica NULL (coluna nullable, sem default)', async () => {
    const grant = await prisma.personCompanyGrant.create({
      data: { personId, companyId, grantType: 'RESPONSIBLE', grantedBy: personId },
      select: { revokeReason: true },
    });
    expect(grant.revokeReason).toBeNull();
  });

  it('aceita gravar o motivo da remoção ao lado de revokedAt/revokedBy', async () => {
    const grant = await prisma.personCompanyGrant.findFirst({
      where: { personId, companyId },
      select: { id: true },
    });
    const updated = await prisma.personCompanyGrant.update({
      where: { id: grant!.id },
      data: { revokedAt: new Date(), revokedBy: personId, revokeReason: 'Saiu da empresa' },
      select: { revokedAt: true, revokedBy: true, revokeReason: true },
    });
    expect(updated.revokedAt).not.toBeNull();
    expect(updated.revokedBy).toBe(personId);
    expect(updated.revokeReason).toBe('Saiu da empresa');
  });
});
