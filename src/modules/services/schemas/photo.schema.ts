import { z } from 'zod';

/**
 * Valida a presença do arquivo e do `serviceId` no `FormData` de upload de foto
 * de serviço (USP-029 / AC-029-4). Só confirma a forma — a validação de MIME
 * real e tamanho (`detectServicePhotoMime`/`isWithinServicePhotoSizeLimit`)
 * acontece depois, sobre os bytes, na Server Action (SVC029-MN-04: extensão/
 * `Content-Type` do browser não é a fonte da verdade).
 */
export const uploadServicePhotoFileSchema = z.object({
  serviceId: z.string().uuid('Serviço inválido.'),
  file: z.instanceof(File, { message: 'Selecione uma foto.' }),
});

export type UploadServicePhotoFileInput = z.input<typeof uploadServicePhotoFileSchema>;

/** Extrai e valida os campos `serviceId`/`file` de um `FormData` de upload. */
export function parseUploadServicePhotoFormData(formData: FormData) {
  return uploadServicePhotoFileSchema.safeParse({
    serviceId: formData.get('serviceId'),
    file: formData.get('file'),
  });
}
