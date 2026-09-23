import { prisma } from '@/shared/lib/prisma';
import type { ContentStatus } from '@/modules/moderation';

/**
 * Lê o status de publicação do currículo (`CandidateProfile.publicationStatus`)
 * do titular, para o KPI "status do currículo" do painel `/inicio` (USP-067 —
 * PNL-01 / A-04). `select` mínimo (só o enum) — dado do próprio titular, sem
 * anonimização (CLAUDE.md: "Direct Prisma access is only OK when a Person
 * views their own data"). `null` quando a Pessoa ainda não tem
 * `CandidateProfile` (nunca preencheu o cadastro de candidato).
 */
export async function getCandidateProfileStatus(personId: string): Promise<ContentStatus | null> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { personId },
    select: { publicationStatus: true },
  });
  return profile === null ? null : (profile.publicationStatus as unknown as ContentStatus);
}
