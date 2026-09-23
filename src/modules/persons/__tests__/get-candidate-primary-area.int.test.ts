import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'node:crypto';

/**
 * Teste de integração de `getCandidatePrimaryArea` (USP-067 — T12 / PNL-01,
 * A-03). Requer Postgres local (`supabase start`).
 *
 * Cobre: área presente, área ausente (CandidateProfile sem
 * `primaryAreaOfInterestId`), e Pessoa sem `CandidateProfile` (→ `null`).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { getCandidatePrimaryArea } = await import('../queries/get-candidate-primary-area');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('getCandidatePrimaryArea — integração (T12)', () => {
  const createdIds: string[] = [];
  let areaId = '';

  afterEach(async () => {
    for (const id of createdIds) {
      await prisma.candidateProfile.deleteMany({ where: { personId: id } });
      await prisma.person.deleteMany({ where: { id } });
    }
    createdIds.length = 0;
    if (areaId) {
      await prisma.jobArea.deleteMany({ where: { id: areaId } });
      areaId = '';
    }
  });

  it('CandidateProfile com área preenchida: retorna o id da área', async () => {
    const area = await prisma.jobArea.create({
      data: { name: 'Área Get Candidate Primary Area Int', isSuggestion: false },
      select: { id: true },
    });
    areaId = area.id;

    const id = crypto.randomUUID();
    await prisma.person.create({ data: { id, fullName: 'Candidata Área Int', status: 'ATIVO' } });
    await prisma.candidateProfile.create({
      data: { personId: id, publicationStatus: 'DRAFT', primaryAreaOfInterestId: areaId },
    });
    createdIds.push(id);

    const result = await getCandidatePrimaryArea(id);
    expect(result).toBe(areaId);
  });

  it('CandidateProfile sem área preenchida: retorna null', async () => {
    const id = crypto.randomUUID();
    await prisma.person.create({ data: { id, fullName: 'Candidata Sem Área Int', status: 'ATIVO' } });
    await prisma.candidateProfile.create({ data: { personId: id, publicationStatus: 'DRAFT' } });
    createdIds.push(id);

    const result = await getCandidatePrimaryArea(id);
    expect(result).toBeNull();
  });

  it('Pessoa sem CandidateProfile: retorna null', async () => {
    const id = crypto.randomUUID();
    await prisma.person.create({ data: { id, fullName: 'Pessoa Sem Perfil Área Int', status: 'ATIVO' } });
    createdIds.push(id);

    const result = await getCandidatePrimaryArea(id);
    expect(result).toBeNull();
  });
});
