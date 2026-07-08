import { describe, it, expect } from 'vitest';
import { detectCvMime, isWithinCvSizeLimit, MAX_CV_BYTES } from '../mime';

/**
 * Regras puras de MIME real (USP-040 / CVE-01, T4). Cada caso mapeia 1:1 a um
 * cenário do spec: PDF/DOC/DOCX válidos, `.pdf` com bytes não-PDF (edge case —
 * extensão não é confiável), zip genérico/OOXML não-Word e bytes aleatórios
 * (ambos → null), e a fronteira de {@link MAX_CV_BYTES}.
 */

function bytesOf(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function asciiBytes(text: string): number[] {
  return Array.from(text).map((c) => c.charCodeAt(0));
}

describe('cv-extraction/domain/mime — detectCvMime', () => {
  it('detecta PDF real pelos magic bytes (%PDF-)', () => {
    const pdfBytes = bytesOf(...asciiBytes('%PDF-1.7\n%âãÏÓ\n'));
    expect(detectCvMime(pdfBytes)).toBe('pdf');
  });

  it('rejeita (null) bytes não-PDF mesmo quando o nome sugere .pdf — MIME real, não extensão', () => {
    // A função nem recebe nome de arquivo: só os bytes decidem (CVE-01 edge case).
    const notPdfBytes = bytesOf(...asciiBytes('conteúdo qualquer, não é PDF'));
    expect(detectCvMime(notPdfBytes)).toBeNull();
  });

  it('detecta DOC legado (OLE2/CFBF) pelos magic bytes', () => {
    const docBytes = bytesOf(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00);
    expect(detectCvMime(docBytes)).toBe('doc');
  });

  it('detecta DOCX (zip OOXML com marcador word/)', () => {
    const docxBytes = bytesOf(
      0x50,
      0x4b,
      0x03,
      0x04, // assinatura zip
      ...asciiBytes('algum preâmbulo binário'),
      ...asciiBytes('word/document.xml'),
    );
    expect(detectCvMime(docxBytes)).toBe('docx');
  });

  it('rejeita (null) zip genérico/OOXML sem o marcador word/ (ex.: xlsx)', () => {
    const genericZipBytes = bytesOf(
      0x50,
      0x4b,
      0x03,
      0x04,
      ...asciiBytes('xl/workbook.xml'), // OOXML de planilha, não de documento
    );
    expect(detectCvMime(genericZipBytes)).toBeNull();
  });

  it('rejeita (null) bytes aleatórios sem nenhuma assinatura conhecida', () => {
    const randomBytes = bytesOf(0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77);
    expect(detectCvMime(randomBytes)).toBeNull();
  });
});

describe('cv-extraction/domain/mime — isWithinCvSizeLimit / MAX_CV_BYTES', () => {
  it('MAX_CV_BYTES é exatamente 5MB', () => {
    expect(MAX_CV_BYTES).toBe(5 * 1024 * 1024);
  });

  it('aceita exatamente o limite (fronteira inclusiva)', () => {
    expect(isWithinCvSizeLimit(MAX_CV_BYTES)).toBe(true);
  });

  it('rejeita 1 byte acima do limite', () => {
    expect(isWithinCvSizeLimit(MAX_CV_BYTES + 1)).toBe(false);
  });

  it('aceita tamanhos bem abaixo do limite', () => {
    expect(isWithinCvSizeLimit(1024)).toBe(true);
  });
});
