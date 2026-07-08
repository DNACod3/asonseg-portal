import { createSupabaseStorageClient, STORAGE_BUCKETS, SIGNED_URL_TTL_SECONDS } from '@/shared/lib/supabase/supabase-storage';
import { childLogger } from '@/shared/lib/logger';

/**
 * Resolve uma URL assinada de curta duração para o CV de um candidato
 * (USP-027 / bucket privado `cvs`, ADR-0005). Server-only.
 *
 * Degrada limpo (nunca lança): `null` quando não há `cvStoragePath`, quando o
 * Storage retorna erro (bucket ausente no ambiente, arquivo removido, etc.) ou
 * em qualquer exceção de rede — o item de candidato ainda é exibido, só sem link
 * de CV (`EmployerCandidateView.cv.available=false`, ver `view-candidate-for-employer.ts`).
 */
export async function resolveCvUrl(path: string | null): Promise<string | null> {
  if (!path) return null;

  try {
    const storage = createSupabaseStorageClient();
    const { data, error } = await storage
      .from(STORAGE_BUCKETS.CVS)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data) {
      childLogger({ module: 'jobs', query: 'listJobApplicants' }).warn(
        { err: error, path },
        'jobs:cv_signed_url_unavailable',
      );
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    childLogger({ module: 'jobs', query: 'listJobApplicants' }).warn(
      { err, path },
      'jobs:cv_signed_url_unavailable',
    );
    return null;
  }
}
