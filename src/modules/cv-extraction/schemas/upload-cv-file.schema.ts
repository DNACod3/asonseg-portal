import { z } from 'zod';

/**
 * Valida a presença e o tipo do arquivo enviado no `FormData` de upload de CV
 * (USP-040 / CVE-01). Só confirma que há um `File` — a validação de MIME real
 * e tamanho (`detectCvMime`/`isWithinCvSizeLimit`) acontece depois, sobre os
 * bytes, na Server Action (CVE-MN-02: extensão/`Content-Type` do browser não
 * é a fonte da verdade).
 */
export const cvUploadFileSchema = z.object({
  file: z.instanceof(File, { message: 'Selecione um arquivo de CV.' }),
});

export type CvUploadFileInput = z.input<typeof cvUploadFileSchema>;

/** Extrai e valida o campo `file` de um `FormData` de upload. */
export function parseCvUploadFormData(formData: FormData) {
  return cvUploadFileSchema.safeParse({ file: formData.get('file') });
}
