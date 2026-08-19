// Unit do PrismaCandidateProfileModerationReader (USP-066 / T4 / E-004 —
// corrigido A1/B1/PR#294) — Prisma mockado; resolução de URL assinada
// delegada a `resolveSignedCvUrl` (promovido para shared/, B1/PR#294 — a
// própria função ganhou seu teste dedicado em
// shared/lib/supabase/__tests__/supabase-storage.test.ts).
// Cobre: mapeamento de campos, delegação da URL do CV ao helper promovido,
// item ausente e o filtro de escopo `publicationStatus: IN_MODERATION` (A1).

import { describe, it, expect, beforeEach, vi } from 'vitest';

const prismaState = vi.hoisted(() => ({ findFirst: vi.fn() }));
const storageState = vi.hoisted(() => ({ resolveSignedCvUrl: vi.fn() }));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { candidateProfile: { findFirst: (...a: unknown[]) => prismaState.findFirst(...a) } },
}));

vi.mock('@/shared/lib/supabase/supabase-storage', () => ({
  resolveSignedCvUrl: (...a: unknown[]) => storageState.resolveSignedCvUrl(...a),
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
  it('mapeia todos os campos de E-004 + delega cvStoragePath a resolveSignedCvUrl (B1)', async () => {
    prismaState.findFirst.mockResolvedValue({ ...baseRow, cvStoragePath: 'cvs/p1/cv.pdf' });
    storageState.resolveSignedCvUrl.mockResolvedValue('https://storage/cvs/p1/cv.pdf?sig=abc');

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
    expect(storageState.resolveSignedCvUrl).toHaveBeenCalledWith(
      'cvs/p1/cv.pdf',
      expect.objectContaining({ module: 'persons' }),
    );
  });

  it('cvStoragePath nulo ⇒ ainda delega a resolveSignedCvUrl (o helper decide degradar a null)', async () => {
    prismaState.findFirst.mockResolvedValue({ ...baseRow, cvStoragePath: null });
    storageState.resolveSignedCvUrl.mockResolvedValue(null);

    const view = await new PrismaCandidateProfileModerationReader().readContent(
      ContentKind.CANDIDATE_PROFILE,
      'p2',
    );

    expect(view).toMatchObject({ kind: 'CANDIDATE_PROFILE', cvUrl: null });
    expect(storageState.resolveSignedCvUrl).toHaveBeenCalledWith(null, expect.any(Object));
  });

  it('resolveSignedCvUrl resolve null (storage indisponível/erro) ⇒ cvUrl: null, sem lançar', async () => {
    prismaState.findFirst.mockResolvedValue({ ...baseRow, cvStoragePath: 'cvs/p3/cv.pdf' });
    storageState.resolveSignedCvUrl.mockResolvedValue(null);

    const view = await new PrismaCandidateProfileModerationReader().readContent(
      ContentKind.CANDIDATE_PROFILE,
      'p3',
    );

    expect(view).toMatchObject({ kind: 'CANDIDATE_PROFILE', cvUrl: null });
  });

  it('findFirst → null ⇒ retorna null (E-006 gracioso) sem chamar resolveSignedCvUrl', async () => {
    prismaState.findFirst.mockResolvedValue(null);
    const view = await new PrismaCandidateProfileModerationReader().readContent(
      ContentKind.CANDIDATE_PROFILE,
      'nope',
    );
    expect(view).toBeNull();
    expect(storageState.resolveSignedCvUrl).not.toHaveBeenCalled();
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
