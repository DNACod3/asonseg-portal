import { describe, it, expect } from 'vitest';
import { detectMimeType, assertRealMimeType } from '@/shared/lib/fileType';

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // %PDF-1.7
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const DOCX = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]); // PK..
const DOC = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const TXT = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]); // "hello"

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('detectMimeType', () => {
  it('reconhece PDF, PNG, JPEG, DOC(ole), zip(ooxml) e webp', () => {
    expect(detectMimeType(PDF)).toBe('application/pdf');
    expect(detectMimeType(PNG)).toBe('image/png');
    expect(detectMimeType(JPEG)).toBe('image/jpeg');
    expect(detectMimeType(DOC)).toBe('application/msword');
    expect(detectMimeType(DOCX)).toBe('application/zip');
    expect(detectMimeType(WEBP)).toBe('image/webp');
  });

  it('reconhece image/gif', () => {
    const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
    expect(detectMimeType(GIF)).toBe('image/gif');
  });

  it('retorna null para conteúdo desconhecido', () => {
    expect(detectMimeType(TXT)).toBeNull();
  });

  it('aceita ArrayBuffer e Buffer além de Uint8Array', () => {
    expect(detectMimeType(PDF.buffer)).toBe('application/pdf');
    expect(detectMimeType(Buffer.from(PNG))).toBe('image/png');
  });
});

describe('assertRealMimeType', () => {
  const cvAllowed = ['application/pdf', DOCX_MIME, 'application/msword'];

  it('aceita PDF na whitelist', () => {
    expect(assertRealMimeType(PDF, cvAllowed)).toEqual({ ok: true, detected: 'application/pdf' });
  });

  it('aceita DOCX (zip) quando o MIME OOXML está na whitelist', () => {
    const r = assertRealMimeType(DOCX, cvAllowed, DOCX_MIME);
    expect(r.ok).toBe(true);
  });

  it('rejeita imagem PNG quando o fluxo só aceita documentos', () => {
    const r = assertRealMimeType(PNG, cvAllowed);
    expect(r).toEqual({ ok: false, reason: 'not_allowed', detected: 'image/png' });
  });

  it('rejeita conteúdo desconhecido', () => {
    const r = assertRealMimeType(TXT, cvAllowed);
    expect(r).toEqual({ ok: false, reason: 'unknown', detected: null });
  });

  it('rejeita quando o conteúdo real diverge do Content-Type declarado (forjado)', () => {
    // Cliente diz "PDF" mas o conteúdo é PNG.
    const r = assertRealMimeType(PNG, ['application/pdf', 'image/png'], 'application/pdf');
    expect(r).toEqual({ ok: false, reason: 'declared_mismatch', detected: 'image/png' });
  });

  it('aceita imagem quando o fluxo permite imagens', () => {
    const r = assertRealMimeType(JPEG, ['image/jpeg', 'image/png'], 'image/jpeg');
    expect(r.ok).toBe(true);
  });
});
