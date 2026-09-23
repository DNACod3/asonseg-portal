import { prisma } from '@/shared/lib/prisma';
import type { ContentStatus } from '@/modules/moderation';

/**
 * Lê o status de publicação do perfil de prestador
 * (`ProviderProfile.publicationStatus`) do titular, para o KPI "status do
 * perfil" do painel `/inicio` (USP-067 — PNL-02 / A-04). `select` mínimo (só o
 * enum) — dado do próprio titular, sem anonimização. `null` quando a Pessoa
 * ainda não tem `ProviderProfile`.
 */
export async function getProviderProfileStatus(personId: string): Promise<ContentStatus | null> {
  const profile = await prisma.providerProfile.findUnique({
    where: { personId },
    select: { publicationStatus: true },
  });
  return profile === null ? null : (profile.publicationStatus as unknown as ContentStatus);
}
