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
}));

vi.mock('@/modules/identity', () => ({
  requireActivePerson: (...a: unknown[]) => state.requireActivePerson(...a),
}));

vi.mock('@/modules/consents', () => ({
  loadTerm: (...a: unknown[]) => state.loadTerm(...a),
  stripTermFrontMatter: (content: string) => content,
  TermLoaderError: class TermLoaderError extends Error {},
}));

vi.mock('@/modules/persons', () => ({
  CandidateForm: () => <div data-testid="candidate-form" />,
}));

vi.mock('@/modules/cv-extraction', () => ({
  CvUploadForm: () => <div data-testid="cv-upload-form" />,
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
  });
  state.findManyJobArea.mockResolvedValue([]);
  state.loadTerm.mockResolvedValue({
    version: 'v1.0',
    hash: 'hash',
    content: 'TERMO: candidatura a vagas.',
  });
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
});
