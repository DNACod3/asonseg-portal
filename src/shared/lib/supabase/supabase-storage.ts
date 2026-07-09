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
 * **Nenhum consumidor concreto ainda** (Fase 0 — Fundação, F0A-04): o 1º
 * consumidor esperado é USP-040 (`consent-terms`, extração de CV) — CV e foto
 * de prestador seguem USPs próprias (043/031). O client fica pronto e
 * verificado (`typecheck`/`build`) para a 1ª Server Action de upload/URL
 * assinada plugar sem reabrir este arquivo.
 */

/** Buckets definidos em ADR-0005 (visibilidade + tamanho máx + TTL de URL assinada). */
export const STORAGE_BUCKETS = {
  /** Privado. PDF/DOC/DOCX até 5MB. URL assinada, TTL 5min. `cvs/{person_id}/{uuid}.{ext}` */
  CVS: 'cvs',
  /** Privado. PDF/JPG/PNG até 10MB. URL assinada, TTL 5min. `consent-terms/{person_id}/{purpose}/{uuid}.{ext}` */
  CONSENT_TERMS: 'consent-terms',
  /** Público. JPG/PNG/WEBP até 5MB (USP-029: até 3 fotos por serviço). URL direta do CDN. `provider-photos/{person_id}/{uuid}.{ext}` */
  PROVIDER_PHOTOS: 'provider-photos',
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/** TTL (segundos) da URL assinada para os buckets privados (ADR-0005). */
export const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Retorna o client de Storage (`supabase.storage`) pronto para uso em Server
 * Actions/Route Handlers: `client.from(STORAGE_BUCKETS.CVS).upload(...)`,
 * `.createSignedUrl(path, SIGNED_URL_TTL_SECONDS)`, `.getPublicUrl(path)`.
 */
export function createSupabaseStorageClient() {
  return createSupabaseAdminClient().storage;
}
