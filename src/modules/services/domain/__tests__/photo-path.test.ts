import { describe, it, expect } from 'vitest';
import { isOwnedServicePhotoPath } from '../photo-path';

/**
 * Regra pura de posse+formato de `photoStoragePath` (F3, review PR #284) —
 * matriz exaustiva de `isOwnedServicePhotoPath`. Cada caso mapeia 1:1 a
 * AC-F3-1..3: path próprio válido → true; primeiro segmento de outro
 * `person.id`, `../`, extensão fora de {jpg,png,webp}, segmentos extras,
 * não-UUID e string vazia → false.
 */

const OWNER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OTHER = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
const PHOTO_UUID = 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

describe('services/domain/photo-path — isOwnedServicePhotoPath', () => {
  it.each(['jpg', 'png', 'webp'])('aceita path próprio válido com extensão .%s', (ext) => {
    expect(isOwnedServicePhotoPath(`${OWNER}/${PHOTO_UUID}.${ext}`, OWNER)).toBe(true);
  });

  it('rejeita path cujo primeiro segmento é outra Pessoa (misatribuição)', () => {
    expect(isOwnedServicePhotoPath(`${OTHER}/${PHOTO_UUID}.jpg`, OWNER)).toBe(false);
  });

  it('rejeita path com travessia de diretório (../)', () => {
    expect(isOwnedServicePhotoPath(`${OWNER}/../${PHOTO_UUID}.jpg`, OWNER)).toBe(false);
  });

  it.each(['jpeg', 'gif', 'svg', 'pdf'])('rejeita extensão fora de {jpg,png,webp}: .%s', (ext) => {
    expect(isOwnedServicePhotoPath(`${OWNER}/${PHOTO_UUID}.${ext}`, OWNER)).toBe(false);
  });

  it('rejeita path sem extensão', () => {
    expect(isOwnedServicePhotoPath(`${OWNER}/${PHOTO_UUID}`, OWNER)).toBe(false);
  });

  it('rejeita path com segmentos extras (mais de um /)', () => {
    expect(isOwnedServicePhotoPath(`${OWNER}/extra/${PHOTO_UUID}.jpg`, OWNER)).toBe(false);
  });

  it('rejeita primeiro segmento não-UUID', () => {
    expect(isOwnedServicePhotoPath(`nao-uuid/${PHOTO_UUID}.jpg`, OWNER)).toBe(false);
  });

  it('rejeita segundo segmento (nome do arquivo) não-UUID', () => {
    expect(isOwnedServicePhotoPath(`${OWNER}/nao-uuid.jpg`, OWNER)).toBe(false);
  });

  it('rejeita string vazia', () => {
    expect(isOwnedServicePhotoPath('', OWNER)).toBe(false);
  });

  it('rejeita path com ownerPersonId correto mas UUID malformado (dígitos a mais)', () => {
    expect(isOwnedServicePhotoPath(`${OWNER}extra/${PHOTO_UUID}.jpg`, OWNER)).toBe(false);
  });
});
