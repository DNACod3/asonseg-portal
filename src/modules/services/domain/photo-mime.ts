/**
 * Detecção de MIME real de foto de serviço (USP-029 / SVC029-MN-04) — regra pura,
 * sem IO. Espelha `cv-extraction/domain/mime.ts` (magic bytes, nunca a extensão
 * do nome do arquivo nem o `Content-Type` do browser).
 *
 * Reconhece apenas os 3 formatos aceitos (AC-029-4): JPEG, PNG, WEBP.
 */

export type ServicePhotoMimeType = 'jpg' | 'png' | 'webp';

/** Tamanho máximo aceito por foto (AC-029-4): 5MB. */
export const MAX_SERVICE_PHOTO_BYTES = 5 * 1024 * 1024;

/** Máximo de fotos por serviço (AC-029-4 / SVC029-MN-04). */
export const MAX_SERVICE_PHOTOS = 3;

// JPEG: FF D8 FF.
const JPEG_MAGIC = [0xff, 0xd8, 0xff] as const;
// PNG: assinatura de 8 bytes.
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
// WEBP: contêiner RIFF ("RIFF" + 4 bytes de tamanho + "WEBP" no offset 8).
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46] as const;
const WEBP_MARKER = [0x57, 0x45, 0x42, 0x50] as const;

function startsWith(bytes: Uint8Array, magic: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (bytes[offset + i] !== magic[i]) return false;
  }
  return true;
}

/**
 * Detecta o MIME real da foto a partir dos bytes. Retorna `null` quando o
 * conteúdo não corresponde a nenhum dos 3 formatos suportados (ex.: PDF
 * renomeado `.jpg` — SVC029-MN-04).
 */
export function detectServicePhotoMime(bytes: Uint8Array): ServicePhotoMimeType | null {
  if (startsWith(bytes, JPEG_MAGIC)) return 'jpg';
  if (startsWith(bytes, PNG_MAGIC)) return 'png';
  if (startsWith(bytes, RIFF_MAGIC) && startsWith(bytes, WEBP_MARKER, 8)) return 'webp';
  return null;
}

/** `true` se o tamanho (bytes) está dentro do limite de {@link MAX_SERVICE_PHOTO_BYTES} (inclusive). */
export function isWithinServicePhotoSizeLimit(byteLength: number): boolean {
  return byteLength <= MAX_SERVICE_PHOTO_BYTES;
}
