import { prisma } from '@/shared/lib/prisma';

/**
 * Lê `CandidateProfile.primaryAreaOfInterestId` do titular, para filtrar o
 * card "Vagas que combinam" do painel `/inicio` por área (USP-067 — PNL-01 /
 * A-03). `select` mínimo (só o id da área) — dado do próprio titular.
 *
 * SPEC_DEVIATION (GAP no design.md): a leitura N1 (`getCandidateProfileStatus`,
 * T1) só cobre `publicationStatus`; o design não listou uma leitura nova para
 * a área primária do CV, embora A-03 exija filtrar `searchJobs` por ela.
 * Reason: em vez de expandir o contrato já commitado de `getCandidateProfileStatus`
 * (T1, PNL-01 — só status) ou fazer Prisma direto no loader (violaria PNL-MN-05),
 * a alternativa mais conservadora é uma 2ª leitura fina dedicada, mesmo padrão
 * de N1/N2 — sem tocar código já commitado, sem novo model/migração.
 * `null` quando a Pessoa não tem `CandidateProfile` ou não preencheu a área.
 */
export async function getCandidatePrimaryArea(personId: string): Promise<string | null> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { personId },
    select: { primaryAreaOfInterestId: true },
  });
  return profile?.primaryAreaOfInterestId ?? null;
}
