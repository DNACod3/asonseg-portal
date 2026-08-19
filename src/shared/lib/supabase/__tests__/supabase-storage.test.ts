// Unit de `resolveSignedCvUrl` (B1/PR#294) — promovido de
// `jobs/queries/list-job-applicants.ts` e
// `persons/adapters/prisma-candidate-profile-moderation-reader.ts` (2+
// consumidores → shared/, regra de promoção do project-guideline §2).
// Cobre a matriz completa de degradação: path nulo, sucesso, erro do
// Storage e exceção de rede — nenhum caminho lança.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// C8 (PR#294 rodada 2) — o mock original descartava o argumento de `from()`,
// então `STORAGE_BUCKETS.CVS` nunca era asserido: trocar o bucket dentro de
// `resolveSignedCvUrl` mantinha a suíte inteira verde, apesar do título do
// caso dizer "(cvs)". Capturamos a chamada em `storageState.from` para poder
// assertá-la contra a fonte de verdade (`STORAGE_BUCKETS.CVS`), não contra o
// literal `'cvs'`.
const storageState = vi.hoisted(() => ({ from: vi.fn(), createSignedUrl: vi.fn() }));

vi.mock('../server', () => ({
  createSupabaseAdminClient: () => ({
    storage: {
      from: (...a: unknown[]) => {
        storageState.from(...a);
        return { createSignedUrl: (...b: unknown[]) => storageState.createSignedUrl(...b) };
      },
    },
  }),
}));

const { resolveSignedCvUrl } = await import('../supabase-storage');
const { STORAGE_BUCKETS } = await import('../storage-buckets');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveSignedCvUrl (B1/PR#294)', () => {
  it('path nulo ⇒ null sem chamar o storage', async () => {
    const url = await resolveSignedCvUrl(null, { module: 'test' });
    expect(url).toBeNull();
    expect(storageState.createSignedUrl).not.toHaveBeenCalled();
  });

  it('sucesso ⇒ devolve a URL assinada com TTL 300s (cvs)', async () => {
    storageState.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage/cvs/p1/cv.pdf?sig=abc' },
      error: null,
    });

    const url = await resolveSignedCvUrl('cvs/p1/cv.pdf', { module: 'test' });

    expect(url).toBe('https://storage/cvs/p1/cv.pdf?sig=abc');
    expect(storageState.createSignedUrl).toHaveBeenCalledWith('cvs/p1/cv.pdf', 300);
    // C8 (PR#294 rodada 2) — fecha o par bucket+TTL do ADR-0005: antes só o
    // TTL (300) tinha sensor; trocar o bucket por outro (ex.: PROVIDER_PHOTOS)
    // dentro de `resolveSignedCvUrl` agora derruba este caso.
    expect(storageState.from).toHaveBeenCalledWith(STORAGE_BUCKETS.CVS);
  });

  it('erro do Storage (bucket ausente/arquivo removido) ⇒ null, nunca lança', async () => {
    storageState.createSignedUrl.mockResolvedValue({ data: null, error: new Error('bucket ausente') });

    const url = await resolveSignedCvUrl('cvs/p2/cv.pdf', { module: 'test' });

    expect(url).toBeNull();
  });

  it('exceção de rede ⇒ null, nunca lança', async () => {
    storageState.createSignedUrl.mockRejectedValue(new Error('rede indisponível'));

    const url = await resolveSignedCvUrl('cvs/p3/cv.pdf', { module: 'test' });

    expect(url).toBeNull();
  });
});
