/**
 * Validação de MIME real por *magic bytes* — Hardening US #200 / #203.
 *
 * Não confie na extensão nem no `Content-Type` declarado pelo cliente: ambos são
 * trivialmente forjáveis. Esta lib lê os primeiros bytes do conteúdo e deriva o
 * tipo real, rejeitando o upload quando o conteúdo diverge do declarado ou não
 * está na whitelist do fluxo (ex.: CV → PDF/DOCX/DOC).
 *
 * Edge/Node-safe: opera sobre `Uint8Array`/`ArrayBuffer`/`Buffer`, sem IO.
 */

export type DetectedMime =
  | 'application/pdf'
  | 'application/msword' // .doc (OLE Compound)
  | 'application/zip' // contêiner OOXML (.docx/.xlsx/.pptx) ou zip puro
  | 'image/png'
  | 'image/jpeg'
  | 'image/gif'
  | 'image/webp';

interface Signature {
  readonly mime: DetectedMime;
  /** Bytes esperados; `null` em uma posição = curinga (qualquer byte). */
  readonly bytes: ReadonlyArray<number | null>;
  /** Offset inicial (default 0). */
  readonly offset?: number;
}

/** Assinaturas conhecidas, avaliadas em ordem (mais específicas primeiro). */
const SIGNATURES: readonly Signature[] = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  // RIFF????WEBP — bytes 0-3 = RIFF, 8-11 = WEBP.
  {
    mime: 'image/webp',
    bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
  },
  { mime: 'application/msword', bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }, // OLE2
  { mime: 'application/zip', bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK.. (OOXML/zip)
];

/** MIMEs OOXML que, no transporte, têm a assinatura de zip (`PK..`). */
const ZIP_BACKED_MIMES = new Set([
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
]);

function toBytes(input: Uint8Array | ArrayBuffer | Buffer): Uint8Array {
  if (input instanceof Uint8Array) return input;
  return new Uint8Array(input);
}

function matches(buf: Uint8Array, sig: Signature): boolean {
  const offset = sig.offset ?? 0;
  if (buf.length < offset + sig.bytes.length) return false;
  return sig.bytes.every((b, i) => b === null || buf[offset + i] === b);
}

/**
 * Detecta o MIME real a partir dos magic bytes. Retorna `null` quando nenhuma
 * assinatura conhecida casa (formato desconhecido).
 */
export function detectMimeType(input: Uint8Array | ArrayBuffer | Buffer): DetectedMime | null {
  const buf = toBytes(input);
  for (const sig of SIGNATURES) {
    if (matches(buf, sig)) return sig.mime;
  }
  return null;
}

export type AssertMimeResult =
  | { readonly ok: true; readonly detected: DetectedMime }
  | { readonly ok: false; readonly reason: 'unknown' | 'not_allowed' | 'declared_mismatch'; readonly detected: DetectedMime | null };

/**
 * Valida o conteúdo contra uma whitelist de MIMEs permitidos e, opcionalmente,
 * contra o MIME declarado pelo cliente.
 *
 * @param input    bytes do arquivo (ou um prefixo com pelo menos os primeiros 16).
 * @param allowed  MIMEs aceitos pelo fluxo (ex.: `['application/pdf', '...docx']`).
 * @param declared MIME declarado (Content-Type); se informado e divergir do real → rejeita.
 */
export function assertRealMimeType(
  input: Uint8Array | ArrayBuffer | Buffer,
  allowed: readonly string[],
  declared?: string,
): AssertMimeResult {
  const detected = detectMimeType(input);
  if (detected === null) return { ok: false, reason: 'unknown', detected: null };

  if (!isAllowed(detected, allowed)) {
    return { ok: false, reason: 'not_allowed', detected };
  }

  if (declared && !sameFamily(detected, declared)) {
    return { ok: false, reason: 'declared_mismatch', detected };
  }

  return { ok: true, detected };
}

/** `detected` satisfaz a whitelist? Considera a família OOXML sob `application/zip`. */
function isAllowed(detected: DetectedMime, allowed: readonly string[]): boolean {
  if (allowed.includes(detected)) return true;
  if (detected === 'application/zip') {
    return allowed.some((a) => ZIP_BACKED_MIMES.has(a));
  }
  return false;
}

/** O MIME declarado é compatível com o detectado? (OOXML ⇄ zip conta como igual.) */
function sameFamily(detected: DetectedMime, declared: string): boolean {
  if (detected === declared) return true;
  if (detected === 'application/zip') return ZIP_BACKED_MIMES.has(declared);
  return false;
}
