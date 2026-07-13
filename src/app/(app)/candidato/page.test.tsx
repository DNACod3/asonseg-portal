import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Guarda de sessão + integração do upload de CV na página de candidato
 * (USP-040, T15). A página delega a autenticação a `requireActivePerson`
 * (ADR-0030, guarda compartilhada já testada em `identity`); aqui cobrimos
 * apenas que a página a invoca e que `CvUploadForm` só aparece quando o
 * candidato já tem `CandidateProfile` (precondição de `uploadCv`).
 */

const state = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  findManyJobArea: vi.fn(),
  findUniqueCandidateProfile: vi.fn(),
  loadTerm: vi.fn(),
  requireActiveConsent: vi.fn(),
  candidateFormProps: vi.fn(),
  cvUploadFormProps: vi.fn(),
}));

vi.mock('@/modules/identity', () => ({
  requireActivePerson: (...a: unknown[]) => state.requireActivePerson(...a),
}));

vi.mock('@/modules/consents', () => ({
  loadTerm: (...a: unknown[]) => state.loadTerm(...a),
  requireActiveConsent: (...a: unknown[]) => state.requireActiveConsent(...a),
  stripTermFrontMatter: (content: string) => content,
  TermLoaderError: class TermLoaderError extends Error {},
}));

vi.mock('@/modules/persons', () => ({
  CandidateForm: (props: unknown) => {
    state.candidateFormProps(props);
    return <div data-testid="candidate-form" />;
  },
}));

vi.mock('@/modules/cv-extraction', () => ({
  CvUploadForm: (props: unknown) => {
    state.cvUploadFormProps(props);
    return <div data-testid="cv-upload-form" />;
  },
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    jobArea: { findMany: (...a: unknown[]) => state.findManyJobArea(...a) },
    candidateProfile: { findUnique: (...a: unknown[]) => state.findUniqueCandidateProfile(...a) },
  },
}));

const { default: CandidatoPage } = await import('./page');

beforeEach(() => {
  vi.clearAllMocks();
  state.requireActivePerson.mockResolvedValue({
    id: 'person-1',
    roles: ['CANDIDATE'],
    phone: null,
  });
  state.findManyJobArea.mockResolvedValue([]);
  // CAND-6: loadTerm agora é chamado 2x (JOB_APPLICATION + CV_AI_EXTRACTION) —
  // resolve por finalidade, como no fluxo real (`loadTerm(purpose)`).
  state.loadTerm.mockImplementation(async (purpose: string) => ({
    version: 'v1.0',
    hash: 'hash',
    content:
      purpose === 'CV_AI_EXTRACTION' ? 'TERMO: extração de currículo por IA.' : 'TERMO: candidatura a vagas.',
  }));
  state.requireActiveConsent.mockResolvedValue({ active: false });
});

describe('CandidatoPage — guarda de sessão + upload de CV (USP-040)', () => {
  it('invoca requireActivePerson (guarda de sessão da página)', async () => {
    state.findUniqueCandidateProfile.mockResolvedValue(null);
    const ui = await CandidatoPage();
    render(ui);
    expect(state.requireActivePerson).toHaveBeenCalledOnce();
  });

  it('mostra o formulário de upload de CV quando o perfil de candidato já existe', async () => {
    state.findUniqueCandidateProfile.mockResolvedValue({ publicationStatus: 'DRAFT' });
    const ui = await CandidatoPage();
    render(ui);
    expect(screen.getByTestId('cv-upload-form')).toBeInTheDocument();
  });

  it('NÃO mostra o formulário de upload de CV antes de o perfil existir', async () => {
    state.findUniqueCandidateProfile.mockResolvedValue(null);
    const ui = await CandidatoPage();
    render(ui);
    expect(screen.queryByTestId('cv-upload-form')).not.toBeInTheDocument();
  });

  it('PERF-04: CandidateForm recebe defaultValues correspondentes ao perfil existente', async () => {
    state.requireActivePerson.mockResolvedValue({
      id: 'person-1',
      roles: ['CANDIDATE'],
      phone: '11988887777',
    });
    state.findUniqueCandidateProfile.mockResolvedValue({
      publicationStatus: 'DRAFT',
      educationLevel: 'ENSINO_MEDIO',
      primaryAreaOfInterestId: 'area-1',
      headline: 'Aux. administrativo',
      experienceText: '3 anos',
    });
    const ui = await CandidatoPage();
    render(ui);
    expect(state.candidateFormProps).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultValues: {
          educationLevel: 'ENSINO_MEDIO',
          primaryAreaOfInterestId: 'area-1',
          phone: '11988887777',
          headline: 'Aux. administrativo',
          experienceText: '3 anos',
        },
      }),
    );
  });

  it('PERF-05: CvUploadForm recebe term e alreadyGranted (finalidade CV_AI_EXTRACTION)', async () => {
    state.findUniqueCandidateProfile.mockResolvedValue({ publicationStatus: 'DRAFT' });
    state.requireActiveConsent.mockResolvedValue({ active: true });
    const ui = await CandidatoPage();
    render(ui);
    expect(state.requireActiveConsent).toHaveBeenCalledWith('person-1', 'CV_AI_EXTRACTION');
    expect(state.cvUploadFormProps).toHaveBeenCalledWith(
      expect.objectContaining({
        term: { version: 'v1.0', contentHash: 'hash', body: 'TERMO: extração de currículo por IA.' },
        alreadyGranted: true,
      }),
    );
  });
});
