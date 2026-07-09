import { z } from 'zod';

/**
 * Valida a presença do arquivo no `FormData` de upload de foto de serviço
 * (USP-029 / AC-029-4). Só confirma a forma — a validação de MIME real e
 * tamanho (`detectServicePhotoMime`/`isWithinServicePhotoSizeLimit`) acontece
 * depois, sobre os bytes, na Server Action (SVC029-MN-04: extensão/`Content-Type`
 * do browser não é a fonte da verdade).
 *
 * Sem `serviceId`: a foto é enviada durante a composição do formulário, antes
 * do serviço existir (design USP-029 §4 — `uploadServicePhoto` só valida/
 * armazena e devolve `storagePath`; quem persiste a linha `ServicePhoto` é
 * `createServiceDraft`/`submitServiceForModeration`, no create atômico).
 */
export const uploadServicePhotoFileSchema = z.object({
  file: z.instanceof(File, { message: 'Selecione uma foto.' }),
});

export type UploadServicePhotoFileInput = z.input<typeof uploadServicePhotoFileSchema>;

/** Extrai e valida o campo `file` de um `FormData` de upload. */
export function parseUploadServicePhotoFormData(formData: FormData) {
  return uploadServicePhotoFileSchema.safeParse({ file: formData.get('file') });
}
