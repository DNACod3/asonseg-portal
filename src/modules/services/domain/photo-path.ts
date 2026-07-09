/**
 * Validação de posse+formato de `photoStoragePath` (USP-029 / F3, review PR #284)
 * — regra pura, sem IO. Espelha `domain/photo-mime.ts`.
 *
 * `uploadServicePhoto` gera exatamente `${person.id}/${randomUUID()}.${mimeType}`
 * (`actions/upload-service-photo.ts:71`), onde `person.id` e `randomUUID()` são
 * UUIDs e `mimeType ∈ {jpg, png, webp}` (`domain/photo-mime.ts` —
 * `ServicePhotoMimeType = 'jpg' | 'png' | 'webp'`). Este helper garante que um
 * `photoStoragePath` recebido do cliente (em `createServiceDraft` /
 * `submitServiceForModeration`) case esse formato estrito **e** pertença à Pessoa
 * da sessão — impede (a) misatribuição de foto de terceiro e (b) persistência
 * crua de string arbitrária (incl. `../`) em `ServicePhoto.storagePath`.
 *
 * Extensões aceitas: `(jpg|png|webp)` — **não** `jpeg`. O detector de MIME real
 * (`detectServicePhotoMime`) nunca emite `.jpeg`; ser mais estrito é seguro
 * (nenhum caminho legítimo termina em `.jpeg`).
 */

const SERVICE_PHOTO_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/**
 * `true` se `path` casa o formato estrito gerado por `uploadServicePhoto` E
 * pertence a `ownerPersonId` (primeiro segmento). O regex garante um único `/`
 * e segmentos hex-UUID — bloqueia `../`, segmentos extras, valores não-UUID e
 * extensões fora de `{jpg, png, webp}`; combinado ao `startsWith`, equivale a
 * "o primeiro segmento é exatamente `ownerPersonId`".
 */
export function isOwnedServicePhotoPath(path: string, ownerPersonId: string): boolean {
  return SERVICE_PHOTO_PATH_RE.test(path) && path.startsWith(`${ownerPersonId}/`);
}
