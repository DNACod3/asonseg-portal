import { env } from '@/shared/env';

/**
 * URL pública de uma foto de serviço, a partir do `storagePath` persistido em
 * `ServicePhoto` (USP-030). O bucket `provider-photos` é público (config.toml)
 * — a URL é determinística (convenção do Supabase Storage), sem precisar do
 * client de Storage nem de IO: `{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}`.
 * Função pura — cabe em `domain/` (sem chamadas de rede).
 */
export function buildServicePhotoUrl(storagePath: string): string {
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/provider-photos/${storagePath}`;
}
