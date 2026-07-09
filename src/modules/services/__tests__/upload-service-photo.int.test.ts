import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `uploadServicePhoto` (USP-029 / T029-7 / AC-029-4).
 * Requer Postgres local (`supabase start`, Storage incluso — bucket
 * `provider-photos` declarado em `supabase/config.toml`, 5MiB/JPG-PNG-WEBP).
 *
 * Real: Supabase Storage local (upload de verdade no bucket `provider-photos`
 * no caminho feliz). Mocks: `getCurrentPerson` (sessão) e — só para o teste de
 * falha de Storage — um override controlável de `createSupabaseStorageClient`.
 *
 * Cobre: happy path JPG/PNG/WEBP (SVC029-MN-04: MIME real, nunca extensão);
 * PDF renomeado `.jpg` → VALIDATION; tamanho >5MB → VALIDATION; falha de
 * Storage → INTERNAL; não autenticado → UNAUTHENTICATED; sem arquivo → VALIDATION.
 * A quantidade máxima (3 fotos) é enforçada no persist (Zod `.max(3)` de
 * `publishServiceSchema`/`draftServiceSchema` — `submit-service.schema.test.ts`),
 * não nesta action stateless (design USP-029 §4 — upload devolve só `storagePath`).
 */

let mockPerson: CurrentPerson | null = null;
vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const storageOverride: { fn: (() => unknown) | null } = { fn: null };
vi.mock('@/shared/lib/supabase/supabase-storage', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/shared/lib/supabase/supabase-storage')>();
  return {
    ...actual,
    createSupabaseStorageClient: (...args: unknown[]) =>
      storageOverride.fn
        ? storageOverride.fn()
        : (actual.createSupabaseStorageClient as (...a: unknown[]) => unknown)(...args),
  };
});

const { prisma } = await import('@/shared/lib/prisma');
const { createSupabaseStorageClient, STORAGE_BUCKETS } = await import(
  '@/shared/lib/supabase/supabase-storage'
);
const { uploadServicePhoto } = await import('../actions/upload-service-photo');
const { MAX_SERVICE_PHOTO_BYTES } = await import('../domain/photo-mime');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

function jpgBytes(size = 1024): Uint8Array {
  const bytes = new Uint8Array(Math.max(size, 4));
  bytes.set([0xff, 0xd8, 0xff]); // JPEG magic
  return bytes;
}

function pngBytes(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
}

function webpBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  bytes.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  return bytes;
}

function fileOf(bytes: Uint8Array, name: string, type: string): File {
  return new File([bytes as unknown as BlobPart], name, { type });
}

function baseMockPerson(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: '00000000-0000-0000-0000-0000000000dd',
    fullName: 'Prestador Foto Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['PROVIDER'],
    phone: null,
    fullAddress: null,
  };
}

async function listStorageFiles(personId: string) {
  const storage = createSupabaseStorageClient().from(STORAGE_BUCKETS.PROVIDER_PHOTOS);
  const { data } = await storage.list(personId);
  return data ?? [];
}

skipIfNoDb('USP-029/T029-7 — uploadServicePhoto (integração)', () => {
  let personId = '';

  beforeAll(async () => {
    const person = await prisma.person.create({
      data: { fullName: 'Prestador Foto Int', status: 'ATIVO' },
      select: { id: true },
    });
    personId = person.id;
  });

  afterAll(async () => {
    const storage = createSupabaseStorageClient().from(STORAGE_BUCKETS.PROVIDER_PHOTOS);
    const files = await listStorageFiles(personId);
    if (files.length > 0) {
      await storage.remove(files.map((f) => `${personId}/${f.name}`));
    }
    await prisma.person.deleteMany({ where: { id: personId } });
  });

  it('AC-029-4 happy path JPG: armazena e devolve storagePath sob {personId}/', async () => {
    mockPerson = baseMockPerson(personId);
    const formData = new FormData();
    formData.set('file', fileOf(jpgBytes(), 'foto.jpg', 'image/jpeg'));

    const res = await uploadServicePhoto(formData);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.storagePath).toMatch(new RegExp(`^${personId}/.+\\.jpg$`));

    const files = await listStorageFiles(personId);
    expect(files.length).toBeGreaterThan(0);
  });

  it('AC-029-4 happy path PNG: MIME real detecta png mesmo com extensão neutra', async () => {
    mockPerson = baseMockPerson(personId);
    const formData = new FormData();
    formData.set('file', fileOf(pngBytes(), 'foto.bin', 'application/octet-stream'));

    const res = await uploadServicePhoto(formData);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.storagePath).toMatch(/\.png$/);
  });

  it('AC-029-4 happy path WEBP', async () => {
    mockPerson = baseMockPerson(personId);
    const formData = new FormData();
    formData.set('file', fileOf(webpBytes(), 'foto.webp', 'image/webp'));

    const res = await uploadServicePhoto(formData);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.storagePath).toMatch(/\.webp$/);
  });

  it('SVC029-MN-04: PDF renomeado .jpg → VALIDATION sem armazenar (MIME real, não extensão)', async () => {
    mockPerson = baseMockPerson(personId);
    const pdfMagic = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0, 0, 0]);
    const formData = new FormData();
    formData.set('file', fileOf(pdfMagic, 'fake.jpg', 'image/jpeg'));

    const before = await listStorageFiles(personId);
    const res = await uploadServicePhoto(formData);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('VALIDATION');
    expect(await listStorageFiles(personId)).toHaveLength(before.length);
  });

  it('SVC029-MN-04: arquivo >5MB → VALIDATION sem armazenar', async () => {
    mockPerson = baseMockPerson(personId);
    const formData = new FormData();
    formData.set('file', fileOf(jpgBytes(MAX_SERVICE_PHOTO_BYTES + 1), 'grande.jpg', 'image/jpeg'));

    const before = await listStorageFiles(personId);
    const res = await uploadServicePhoto(formData);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('VALIDATION');
    expect(await listStorageFiles(personId)).toHaveLength(before.length);
  });

  it('falha de Storage: retorna INTERNAL (nunca lança)', async () => {
    mockPerson = baseMockPerson(personId);
    storageOverride.fn = () => ({
      from: () => ({
        upload: async () => ({
          data: null,
          error: { message: 'simulated storage failure', name: 'StorageApiError' },
        }),
      }),
    });

    try {
      const formData = new FormData();
      formData.set('file', fileOf(jpgBytes(), 'foto.jpg', 'image/jpeg'));
      const res = await uploadServicePhoto(formData);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error.code).toBe('INTERNAL');
    } finally {
      storageOverride.fn = null;
    }
  });

  it('não autenticado: bloqueia com UNAUTHENTICATED', async () => {
    mockPerson = null;
    const formData = new FormData();
    formData.set('file', fileOf(jpgBytes(), 'foto.jpg', 'image/jpeg'));

    const res = await uploadServicePhoto(formData);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('UNAUTHENTICATED');
  });

  it('MN-F2: sessão sem papel PROVIDER → FORBIDDEN, sem escrita no Storage', async () => {
    mockPerson = { ...baseMockPerson(personId), roles: [] };
    const formData = new FormData();
    formData.set('file', fileOf(jpgBytes(), 'foto.jpg', 'image/jpeg'));

    const before = await listStorageFiles(personId);
    const res = await uploadServicePhoto(formData);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('FORBIDDEN');
    expect(await listStorageFiles(personId)).toHaveLength(before.length);
  });

  it('sem arquivo: bloqueia com VALIDATION', async () => {
    mockPerson = baseMockPerson(personId);
    const formData = new FormData();

    const res = await uploadServicePhoto(formData);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('VALIDATION');
  });
});
