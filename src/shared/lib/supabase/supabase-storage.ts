import { createSupabaseAdminClient } from './server';

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
