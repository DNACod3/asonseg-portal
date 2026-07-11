import { describe, it, expect } from 'vitest';
import {
  detectServicePhotoMime,
  isWithinServicePhotoSizeLimit,
  MAX_SERVICE_PHOTO_BYTES,
} from '../photo-mime';

/**
 * Detecção pura de MIME real de foto de serviço por magic bytes (USP-029 /
 * SVC029-MN-04) — matriz exaustiva de `detectServicePhotoMime` e do limite de
 * tamanho. Cobre cada ramo: os 3 formatos aceitos (JPEG/PNG/WEBP), o RIFF sem
 * marcador WEBP no offset 8 (curto-circuito do `&&`), buffer curto demais (guarda
 * de comprimento), mismatch de byte no laço, formato desconhecido (PDF renomeado)
 * e as duas bordas do limite de 5MB (inclusive).
 */

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x11]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
// RIFF....WEBP (bytes 4-7 = tamanho, irrelevantes p/ a detecção).
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
// RIFF válido, mas offset 8 NÃO é "WEBP" (ex.: WAVE) → não é foto suportada.
const RIFF_NOT_WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-

describe('services/domain/photo-mime — detectServicePhotoMime', () => {
  it('detecta JPEG (FF D8 FF)', () => {
    expect(detectServicePhotoMime(JPEG)).toBe('jpg');
  });

  it('detecta PNG (assinatura de 8 bytes)', () => {
    expect(detectServicePhotoMime(PNG)).toBe('png');
  });

  it('detecta WEBP (RIFF + marcador WEBP no offset 8)', () => {
    expect(detectServicePhotoMime(WEBP)).toBe('webp');
  });

  it('retorna null para contêiner RIFF sem marcador WEBP (ex.: WAVE) — curto-circuita o &&', () => {
    expect(detectServicePhotoMime(RIFF_NOT_WEBP)).toBeNull();
  });

  it('retorna null para buffer curto demais (guarda de comprimento)', () => {
    expect(detectServicePhotoMime(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(detectServicePhotoMime(new Uint8Array())).toBeNull();
  });

  it('retorna null quando um byte diverge do magic (mismatch no laço)', () => {
    expect(detectServicePhotoMime(new Uint8Array([0xff, 0xd8, 0x00, 0x00]))).toBeNull();
  });

  it('retorna null para formato não suportado (PDF renomeado — SVC029-MN-04)', () => {
    expect(detectServicePhotoMime(PDF)).toBeNull();
  });
});

describe('services/domain/photo-mime — isWithinServicePhotoSizeLimit', () => {
  it('aceita tamanho exatamente no limite de 5MB (inclusive)', () => {
    expect(isWithinServicePhotoSizeLimit(MAX_SERVICE_PHOTO_BYTES)).toBe(true);
  });

  it('aceita tamanho abaixo do limite', () => {
    expect(isWithinServicePhotoSizeLimit(0)).toBe(true);
  });

  it('rejeita tamanho acima do limite', () => {
    expect(isWithinServicePhotoSizeLimit(MAX_SERVICE_PHOTO_BYTES + 1)).toBe(false);
  });
});
