import { Prisma } from '@prisma/client';
import type { ContentKind, ContentModerationReader, ModerationContentView } from '@/modules/moderation';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import {
  createSupabaseStorageClient,
  STORAGE_BUCKETS,
  SIGNED_URL_TTL_SECONDS,
} from '@/shared/lib/supabase/supabase-storage';

const log = childLogger({ module: 'persons', adapter: 'PrismaCandidateProfileModerationReader' });

/**
 * Resolve a URL assinada do CV (bucket privado `cvs`, TTL 300s — ADR-0005).
 *
 * Réplica intencional do padrão de `jobs/queries/list-job-applicants.ts:26`
 * (`resolveCvUrl`), em vez de importá-lo: `jobs` já importa `@/modules/persons`
 * (`viewCandidateForEmployer`), então importar `resolveCvUrl` daqui criaria um
 * ciclo de barrels persons↔jobs. Degrada limpo (nunca lança): `null` sem
 * `cvStoragePath`, com erro do Storage ou qualquer exceção de rede.
 */
async function resolveSignedCvUrl(path: string | null): Promise<string | null> {
  if (!path) return null;

  try {
    const storage = createSupabaseStorageClient();
    const { data, error } = await storage
      .from(STORAGE_BUCKETS.CVS)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data) {
      log.warn({ err: error, path }, 'persons:moderation_cv_signed_url_unavailable');
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    log.warn({ err, path }, 'persons:moderation_cv_signed_url_unavailable');
    return null;
  }
}

const candidateProfileModerationSelect = {
  headline: true,
  educationLevel: true,
  educationArea: true,
  experienceText: true,
  skillsText: true,
  coursesText: true,
  cvStoragePath: true,
} satisfies Prisma.CandidateProfileSelect;

/**
 * Adapter Prisma do {@link ContentModerationReader} para o perfil de candidato
 * (USP-066 / E-004). `contentId` é o `personId` (PK do perfil — mesmo padrão de
 * {@link PrismaCandidateProfileStatusRepository}). Lê o conteúdo integral do
 * rascunho `IN_MODERATION` + resolve a URL assinada do CV.
 */
export class PrismaCandidateProfileModerationReader implements ContentModerationReader {
  async readContent(_kind: ContentKind, personId: string): Promise<ModerationContentView | null> {
    const row = await prisma.candidateProfile.findUnique({
      where: { personId },
      select: candidateProfileModerationSelect,
    });
    if (!row) return null;

    const cvUrl = await resolveSignedCvUrl(row.cvStoragePath);

    return {
      kind: 'CANDIDATE_PROFILE',
      headline: row.headline,
      educationLevel: row.educationLevel,
      educationArea: row.educationArea,
      experience: row.experienceText,
      skills: row.skillsText,
      courses: row.coursesText,
      cvUrl,
    };
  }
}
