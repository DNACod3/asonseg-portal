import { createSupabaseAdminClient } from './server';
import { childLogger } from '@/shared/lib/logger';
import { STORAGE_BUCKETS, SIGNED_URL_TTL_SECONDS } from './storage-buckets';

/**
 * Client de Supabase Storage para uso server-side (ADR-0005 — Storage de
 * arquivos sensíveis com URLs assinadas).
 *
 * Usa o client **admin** (service role): ADR-0003 (técnico) decide autorização
 * aplicacional sem RLS, e o mesmo princípio vale para Storage — não usamos
 * policies de bucket; toda leitura/escrita é mediada por uma Server Action que
 * verifica permissão **antes** de fazer upload, gerar URL assinada (bucket
 * privado) ou montar a URL pública (bucket público). Nunca importar/expor no
 * client — só Server Actions/Route Handlers.
 *
 * As constantes/specs de bucket vivem em `./storage-buckets` (módulo-leaf sem
 * `next/headers`, importável por scripts Node) e são reexportadas aqui para
 * manter os imports existentes (`@/shared/lib/supabase/supabase-storage`).
 */

export {
  STORAGE_BUCKETS,
  STORAGE_BUCKET_SPECS,
  SIGNED_URL_TTL_SECONDS,
  type StorageBucket,
  type StorageBucketSpec,
} from './storage-buckets';

/**
 * Retorna o client de Storage (`supabase.storage`) pronto para uso em Server
 * Actions/Route Handlers: `client.from(STORAGE_BUCKETS.CVS).upload(...)`,
 * `.createSignedUrl(path, SIGNED_URL_TTL_SECONDS)`, `.getPublicUrl(path)`.
 */
export function createSupabaseStorageClient() {
  return createSupabaseAdminClient().storage;
}

/**
 * Resolve uma URL assinada de curta duração para o CV de um candidato
 * (bucket privado `cvs`, TTL 300s — ADR-0005). Server-only.
 *
 * **Promovido de `jobs/queries/list-job-applicants.ts` e
 * `persons/adapters/prisma-candidate-profile-moderation-reader.ts`**
 * (correção B1 do review da PR #294): os dois módulos tinham cópias
 * idênticas (mesmo bucket/TTL/degradação, só o nome do evento de log
 * divergia). A justificativa original para duplicar — "importar de `jobs`
 * criaria um ciclo `persons↔jobs`" — não se sustentava: os dois imports
 * `persons → jobs` existentes já são `import type` (apagados na
 * compilação), então importar um valor de `jobs` de dentro de `persons`
 * teria criado o único ciclo de runtime real. A saída correta (regra de
 * promoção do project-guideline §2 — 2+ consumidores → `shared/`) é esta:
 * nenhum dos dois módulos "dá emprestado" Storage para o outro.
 *
 * Degrada limpo (nunca lança): `null` quando não há `path`, quando o
 * Storage retorna erro (bucket ausente no ambiente, arquivo removido, etc.)
 * ou em qualquer exceção de rede.
 *
 * @param path `cvStoragePath` do candidato, ou `null`.
 * @param logCtx Bindings extra do logger (ex.: `{ module: 'jobs', query: 'listJobApplicants' }`)
 *   — para diferenciar a origem da chamada nos logs estruturados.
 */
export async function resolveSignedCvUrl(
  path: string | null,
  logCtx: Record<string, unknown>,
): Promise<string | null> {
  if (!path) return null;

  try {
    const storage = createSupabaseStorageClient();
    const { data, error } = await storage
      .from(STORAGE_BUCKETS.CVS)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data) {
      childLogger(logCtx).warn({ err: error, path }, 'storage:cv_signed_url_unavailable');
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    childLogger(logCtx).warn({ err, path }, 'storage:cv_signed_url_unavailable');
    return null;
  }
}
