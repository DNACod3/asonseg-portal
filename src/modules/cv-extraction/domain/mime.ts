import type { CvMimeType } from '../ports/cv-extractor.port';

export type { CvMimeType };

/**
 * Detecção de MIME real de um CV (USP-040 / CVE-01) — regra pura, sem IO.
 *
 * Nunca confia na extensão do arquivo: um `.pdf` com bytes que não são PDF é
 * rejeitado (CVE-MN-02 / edge case). Reconhece apenas os 3 formatos do MVP via
 * magic bytes: PDF, DOC (OLE2/CFBF) e DOCX (zip OOXML com o marcador `word/`).
 */

/** Tamanho máximo aceito para o arquivo de CV (CVE-01): 5MB. */
export const MAX_CV_BYTES = 5 * 1024 * 1024;

// `%PDF-` em ASCII.
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;
// Assinatura do Compound File Binary Format (OLE2) — formato do `.doc` legado.
const DOC_OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;
// Assinatura de arquivo ZIP (local file header) — base do OOXML (`.docx`, `.xlsx`, ...).
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;
// `word/` em ASCII — marcador de que o zip OOXML é especificamente um DOCX
// (a pasta `word/` só existe em documentos do Word), não outro tipo de OOXML.
const DOCX_MARKER = [0x77, 0x6f, 0x72, 0x64, 0x2f] as const;

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic[i]) return false;
  }
  return true;
}

/** Varredura simples de subsequência de bytes (arquivo pequeno — custo aceitável). */
function includesSequence(bytes: Uint8Array, needle: readonly number[]): boolean {
  outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * Detecta o MIME real do CV a partir dos bytes. Retorna `null` quando o
 * conteúdo não corresponde a nenhum dos 3 formatos suportados — inclui zips
 * genéricos/OOXML que não são DOCX (sem o marcador `word/`) e bytes aleatórios.
 */
export function detectCvMime(bytes: Uint8Array): CvMimeType | null {
  if (startsWith(bytes, PDF_MAGIC)) return 'pdf';
  if (startsWith(bytes, DOC_OLE2_MAGIC)) return 'doc';
  if (startsWith(bytes, ZIP_MAGIC) && includesSequence(bytes, DOCX_MARKER)) return 'docx';
  return null;
}

/** `true` se o tamanho (bytes) está dentro do limite de {@link MAX_CV_BYTES} (inclusive). */
export function isWithinCvSizeLimit(byteLength: number): boolean {
  return byteLength <= MAX_CV_BYTES;
}
