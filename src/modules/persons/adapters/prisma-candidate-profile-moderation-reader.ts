import { ContentStatus as PrismaContentStatus, Prisma } from '@prisma/client';
import type { ContentKind, ContentModerationReader, ModerationContentView } from '@/modules/moderation';
import { prisma } from '@/shared/lib/prisma';
import { resolveSignedCvUrl } from '@/shared/lib/supabase/supabase-storage';

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
 * rascunho, **escopado a `publicationStatus: IN_MODERATION`** (correção A1 do
 * review da PR #294): `contentId` chega do cliente e só é validado como UUID
 * (`openContentSchema`); sem este filtro, qualquer portador de `MODERATE_CV`
 * conseguiria ler PII + URL assinada de CV de **qualquer** perfil por
 * `personId` — inclusive `DRAFT`/`PUBLISHED`/`ARCHIVED` que a fila
 * (`viewModerationQueue`, mesmo filtro) jamais listaria. `@@index([publicationStatus])`
 * já existe (`prisma/schema.prisma`). Fora do estado ⇒ `null` ⇒ `NOT_FOUND` (E-006).
 */
export class PrismaCandidateProfileModerationReader implements ContentModerationReader {
  async readContent(_kind: ContentKind, personId: string): Promise<ModerationContentView | null> {
    const row = await prisma.candidateProfile.findFirst({
      where: { personId, publicationStatus: PrismaContentStatus.IN_MODERATION },
      select: candidateProfileModerationSelect,
    });
    if (!row) return null;

    const cvUrl = await resolveSignedCvUrl(row.cvStoragePath, {
      module: 'persons',
      adapter: 'PrismaCandidateProfileModerationReader',
    });

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
