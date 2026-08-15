// Unit do PrismaCandidateProfileModerationReader (USP-066 / T4 / E-004) —
// Prisma + client de Storage mockados.
// Cobre: mapeamento de campos, URL assinada de CV (TTL 300s), cvStoragePath
// nulo (sem chamar storage), erro de storage (degrada a null) e item ausente.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const prismaState = vi.hoisted(() => ({ findUnique: vi.fn() }));
const storageState = vi.hoisted(() => ({ createSignedUrl: vi.fn() }));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { candidateProfile: { findUnique: (...a: unknown[]) => prismaState.findUnique(...a) } },
}));

vi.mock('@/shared/lib/supabase/supabase-storage', () => ({
  createSupabaseStorageClient: () => ({
    from: () => ({ createSignedUrl: (...a: unknown[]) => storageState.createSignedUrl(...a) }),
  }),
  STORAGE_BUCKETS: { CVS: 'cvs' },
  SIGNED_URL_TTL_SECONDS: 300,
}));

const { PrismaCandidateProfileModerationReader } = await import(
  '../prisma-candidate-profile-moderation-reader'
);
const { ContentKind } = await import('@/modules/moderation');

beforeEach(() => {
  vi.clearAllMocks();
});

const baseRow = {
  headline: 'Analista de dados',
  educationLevel: 'Superior completo',
  educationArea: 'Estatística',
  experienceText: 'Experiência integral do candidato',
  skillsText: 'Excel, SQL, Python',
  coursesText: 'Curso de Power BI',
  cvStoragePath: null as string | null,
};

describe('PrismaCandidateProfileModerationReader (T4/E-004)', () => {
  it('mapeia todos os campos de E-004 + cvUrl assinada com TTL 300s quando há cvStoragePath', async () => {
    prismaState.findUnique.mockResolvedValue({ ...baseRow, cvStoragePath: 'cvs/p1/cv.pdf' });
    storageState.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage/cvs/p1/cv.pdf?sig=abc' },
      error: null,
    });

    const view = await new PrismaCandidateProfileModerationReader().readContent(
      ContentKind.CANDIDATE_PROFILE,
      'p1',
    );

    expect(view).toMatchObject({
      kind: 'CANDIDATE_PROFILE',
      headline: 'Analista de dados',
      educationLevel: 'Superior completo',
      educationArea: 'Estatística',
      experience: 'Experiência integral do candidato',
      skills: 'Excel, SQL, Python',
      courses: 'Curso de Power BI',
      cvUrl: 'https://storage/cvs/p1/cv.pdf?sig=abc',
    });
    expect(storageState.createSignedUrl).toHaveBeenCalledWith('cvs/p1/cv.pdf', 300);
  });

  it('cvStoragePath nulo ⇒ cvUrl: null sem chamar o storage', async () => {
    prismaState.findUnique.mockResolvedValue({ ...baseRow, cvStoragePath: null });

    const view = await new PrismaCandidateProfileModerationReader().readContent(
      ContentKind.CANDIDATE_PROFILE,
      'p2',
    );

    expect(view).toMatchObject({ kind: 'CANDIDATE_PROFILE', cvUrl: null });
    expect(storageState.createSignedUrl).not.toHaveBeenCalled();
  });

  it('erro do storage ⇒ cvUrl: null (degradação limpa, nunca lança)', async () => {
    prismaState.findUnique.mockResolvedValue({ ...baseRow, cvStoragePath: 'cvs/p3/cv.pdf' });
    storageState.createSignedUrl.mockResolvedValue({ data: null, error: new Error('bucket ausente') });

    const view = await new PrismaCandidateProfileModerationReader().readContent(
      ContentKind.CANDIDATE_PROFILE,
      'p3',
    );

    expect(view).toMatchObject({ kind: 'CANDIDATE_PROFILE', cvUrl: null });
  });

  it('exceção do client de storage ⇒ cvUrl: null (nunca lança)', async () => {
    prismaState.findUnique.mockResolvedValue({ ...baseRow, cvStoragePath: 'cvs/p4/cv.pdf' });
    storageState.createSignedUrl.mockRejectedValue(new Error('rede indisponível'));

    const view = await new PrismaCandidateProfileModerationReader().readContent(
      ContentKind.CANDIDATE_PROFILE,
      'p4',
    );

    expect(view).toMatchObject({ kind: 'CANDIDATE_PROFILE', cvUrl: null });
  });

  it('findUnique → null ⇒ retorna null (E-006 gracioso)', async () => {
    prismaState.findUnique.mockResolvedValue(null);
    const view = await new PrismaCandidateProfileModerationReader().readContent(
      ContentKind.CANDIDATE_PROFILE,
      'nope',
    );
    expect(view).toBeNull();
  });
});
