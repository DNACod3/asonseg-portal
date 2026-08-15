/**
 * Constantes dos buckets de Storage (ADR-0005) — **módulo-leaf puro**: sem IO,
 * sem `next/headers`, sem client de Supabase.
 *
 * Separado de `supabase-storage.ts` de propósito: aquele arquivo importa
 * `./server` (que puxa `next/headers`) e por isso não é importável de um script
 * Node fora do contexto de request. `scripts/ensure-buckets.ts` precisa das
 * specs sem arrastar o runtime do Next junto. `supabase-storage.ts` reexporta
 * tudo daqui, então os imports existentes seguem válidos.
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

/** Especificação de um bucket, no formato aceito pela API de Storage do Supabase. */
export interface StorageBucketSpec {
  name: StorageBucket;
  public: boolean;
  /** Limite de tamanho por arquivo, em bytes. */
  fileSizeLimit: number;
  allowedMimeTypes: readonly string[];
}

const MIB = 1024 * 1024;

/**
 * Specs dos buckets do MVP (ADR-0005) — **fonte de verdade versionada** para
 * provisionar ambientes hospedados (staging/produção) via
 * `npm run storage:ensure:*` (`scripts/ensure-buckets.ts`).
 *
 * `supabase/config.toml` declara os mesmos buckets, mas só provisiona a stack
 * **local** do CLI; projeto hospedado não lê `config.toml`. Antes desta spec o
 * passo era manual (Studio, DoD da task #97), o que fez o bucket `cvs` nunca
 * existir no projeto de staging — todo upload de CV caía no ramo de erro de
 * `upload-cv.ts` (AD-030). Manter os dois lados em sincronia ao alterar
 * qualquer bucket.
 */
export const STORAGE_BUCKET_SPECS: readonly StorageBucketSpec[] = [
  {
    name: STORAGE_BUCKETS.CVS,
    public: false,
    fileSizeLimit: 5 * MIB,
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  {
    name: STORAGE_BUCKETS.CONSENT_TERMS,
    public: false,
    fileSizeLimit: 10 * MIB,
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  {
    name: STORAGE_BUCKETS.PROVIDER_PHOTOS,
    public: true,
    fileSizeLimit: 5 * MIB,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
];
