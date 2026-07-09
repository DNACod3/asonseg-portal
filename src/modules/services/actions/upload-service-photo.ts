'use server';

import { randomUUID } from 'node:crypto';
import { getCurrentPerson } from '@/modules/identity';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import {
  createSupabaseStorageClient,
  STORAGE_BUCKETS,
} from '@/shared/lib/supabase/supabase-storage';
import {
  detectServicePhotoMime,
  isWithinServicePhotoSizeLimit,
  type ServicePhotoMimeType,
} from '../domain/photo-mime';
import { parseUploadServicePhotoFormData } from '../schemas/photo.schema';

export interface UploadServicePhotoResult {
  storagePath: string;
}

const CONTENT_TYPE_BY_MIME: Record<ServicePhotoMimeType, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * Upload de foto de serviço (USP-029 / AC-029-4). Valida MIME real (magic bytes,
 * nunca a extensão/`Content-Type` do browser) + tamanho ANTES de tocar o Storage
 * (SVC029-MN-04) e devolve só o `storagePath` — quem persiste a linha
 * `ServicePhoto` é `createServiceDraft`/`submitServiceForModeration` (o
 * `ServiceForm` sobe cada foto por esta action e passa os `storagePath`
 * acumulados ao submit, design USP-029 §4). Espelha `uploadCv`
 * (`@/modules/cv-extraction`), mas exige apenas papel PROVIDER ativo (F2) —
 * sem consentimento dedicado, já que a foto ainda não pertence a um serviço
 * até o create/submit.
 *
 * Nunca lança.
 */
export async function uploadServicePhoto(
  formData: FormData,
): Promise<ActionResult<UploadServicePhotoResult>> {
  const log = childLogger({ module: 'services', action: 'uploadServicePhoto' });

  // 1. Validação de input: presença/tipo do File.
  const parsedFile = parseUploadServicePhotoFormData(formData);
  if (!parsedFile.success) {
    return fail('VALIDATION', 'Selecione uma foto.');
  }
  const { file } = parsedFile.data;

  // 2. Ownership — Pessoa autenticada da sessão.
  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // 2b. Permissão (F2) — gate de papel PROVIDER, antes de tocar o Storage.
  //     Espelha o 1º check de `requireServiceAuthorization`
  //     (`server/require-service-authorization.ts:23-25`), sem exigir o consent
  //     `SERVICE_OFFERING` — a foto ainda não pertence a um serviço até o
  //     create/submit (spec assumption 2).
  if (!person.roles.includes('PROVIDER')) {
    return fail('FORBIDDEN', 'Você precisa ativar o papel de prestador para enviar fotos de serviço.');
  }

  // 3. MIME real + tamanho (AC-029-4 / SVC029-MN-04) — nunca a extensão do nome
  //    do arquivo. Rejeitado aqui: sem storage.
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isWithinServicePhotoSizeLimit(bytes.byteLength)) {
    return fail('VALIDATION', 'A foto excede o limite de 5MB.');
  }
  const mimeType = detectServicePhotoMime(bytes);
  if (!mimeType) {
    return fail('VALIDATION', 'Arquivo inválido. Envie uma foto em JPG, PNG ou WEBP.');
  }

  // 4. Storage — path determinístico por Pessoa (ADR-0005), relativo ao bucket
  //    `provider-photos` (público).
  const storagePath = `${person.id}/${randomUUID()}.${mimeType}`;
  const storage = createSupabaseStorageClient().from(STORAGE_BUCKETS.PROVIDER_PHOTOS);
  const uploadResult = await storage.upload(storagePath, Buffer.from(bytes), {
    contentType: CONTENT_TYPE_BY_MIME[mimeType],
  });
  if (uploadResult.error) {
    log.error({ err: uploadResult.error, personId: person.id }, 'services:upload_photo_storage_failed');
    return fail('INTERNAL', 'Não foi possível enviar a foto. Tente novamente.');
  }

  log.info({ personId: person.id, storagePath }, 'services:photo_uploaded');
  return ok({ storagePath });
}
