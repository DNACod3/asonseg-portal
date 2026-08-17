// Unit do PrismaCandidateProfileModerationReader (USP-066 / T4 / E-004 —
// corrigido A1/PR#294) — Prisma + client de Storage mockados.
// Cobre: mapeamento de campos, URL assinada de CV (TTL 300s), cvStoragePath
// nulo (sem chamar storage), erro de storage (degrada a null), item ausente,
// e o filtro de escopo `publicationStatus: IN_MODERATION` (A1 — minimização,
// impede ler PII/CV de perfil fora do que a fila lista).

import { describe, it, expect, beforeEach, vi } from 'vitest';

const prismaState = vi.hoisted(() => ({ findFirst: vi.fn() }));
const storageState = vi.hoisted(() => ({ createSignedUrl: vi.fn() }));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { candidateProfile: { findFirst: (...a: unknown[]) => prismaState.findFirst(...a) } },
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
    prismaState.findFirst.mockResolvedValue({ ...baseRow, cvStoragePath: 'cvs/p1/cv.pdf' });
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
    prismaState.findFirst.mockResolvedValue({ ...baseRow, cvStoragePath: null });

    const view = await new PrismaCandidateProfileModerationReader().readContent(
      ContentKind.CANDIDATE_PROFILE,
      'p2',
    );

    expect(view).toMatchObject({ kind: 'CANDIDATE_PROFILE', cvUrl: null });
    expect(storageState.createSignedUrl).not.toHaveBeenCalled();
  });

  it('erro do storage ⇒ cvUrl: null (degradação limpa, nunca lança)', async () => {
    prismaState.findFirst.mockResolvedValue({ ...baseRow, cvStoragePath: 'cvs/p3/cv.pdf' });
    storageState.createSignedUrl.mockResolvedValue({ data: null, error: new Error('bucket ausente') });

    const view = await new PrismaCandidateProfileModerationReader().readContent(
      ContentKind.CANDIDATE_PROFILE,
      'p3',
    );

    expect(view).toMatchObject({ kind: 'CANDIDATE_PROFILE', cvUrl: null });
  });

  it('exceção do client de storage ⇒ cvUrl: null (nunca lança)', async () => {
    prismaState.findFirst.mockResolvedValue({ ...baseRow, cvStoragePath: 'cvs/p4/cv.pdf' });
    storageState.createSignedUrl.mockRejectedValue(new Error('rede indisponível'));

    const view = await new PrismaCandidateProfileModerationReader().readContent(
      ContentKind.CANDIDATE_PROFILE,
      'p4',
    );

    expect(view).toMatchObject({ kind: 'CANDIDATE_PROFILE', cvUrl: null });
  });

  it('findFirst → null ⇒ retorna null (E-006 gracioso)', async () => {
    prismaState.findFirst.mockResolvedValue(null);
    const view = await new PrismaCandidateProfileModerationReader().readContent(
      ContentKind.CANDIDATE_PROFILE,
      'nope',
    );
    expect(view).toBeNull();
  });

  it('A1 (PR#294): escopa a leitura a publicationStatus IN_MODERATION — perfil ACTIVE/DRAFT/ARCHIVED não é servido', async () => {
    // Prova que o adapter passa o filtro correto ao Prisma (o Postgres real é
    // quem de fato barra a linha fora do estado — coberto em
    // open-content.int.test.ts com DB real).
    prismaState.findFirst.mockResolvedValue(null);

    const view = await new PrismaCandidateProfileModerationReader().readContent(
      ContentKind.CANDIDATE_PROFILE,
      'p-active',
    );

    expect(view).toBeNull();
    expect(prismaState.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { personId: 'p-active', publicationStatus: 'IN_MODERATION' },
      }),
    );
  });
});
