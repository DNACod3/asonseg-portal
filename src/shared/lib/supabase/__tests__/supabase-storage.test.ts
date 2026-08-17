// Unit de `resolveSignedCvUrl` (B1/PR#294) — promovido de
// `jobs/queries/list-job-applicants.ts` e
// `persons/adapters/prisma-candidate-profile-moderation-reader.ts` (2+
// consumidores → shared/, regra de promoção do project-guideline §2).
// Cobre a matriz completa de degradação: path nulo, sucesso, erro do
// Storage e exceção de rede — nenhum caminho lança.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const storageState = vi.hoisted(() => ({ createSignedUrl: vi.fn() }));

vi.mock('../server', () => ({
  createSupabaseAdminClient: () => ({
    storage: {
      from: () => ({ createSignedUrl: (...a: unknown[]) => storageState.createSignedUrl(...a) }),
    },
  }),
}));

const { resolveSignedCvUrl } = await import('../supabase-storage');

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
