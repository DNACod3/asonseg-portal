import { describe, it, expect } from 'vitest';
import { parseCvUploadFormData } from '../upload-cv-file.schema';

/**
 * Validação de presença/tipo do `File` no upload de CV (USP-040 / CVE-01, T11).
 */
describe('cv-extraction/schemas/upload-cv-file — parseCvUploadFormData', () => {
  it('aceita FormData com um File presente', () => {
    const formData = new FormData();
    formData.set('file', new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' }));
    const result = parseCvUploadFormData(formData);
    expect(result.success).toBe(true);
  });

  it('rejeita FormData sem o campo file', () => {
    const formData = new FormData();
    const result = parseCvUploadFormData(formData);
    expect(result.success).toBe(false);
  });

  it('rejeita quando o campo file é uma string (não um File)', () => {
    const formData = new FormData();
    formData.set('file', 'não é um arquivo');
    const result = parseCvUploadFormData(formData);
    expect(result.success).toBe(false);
  });
});
