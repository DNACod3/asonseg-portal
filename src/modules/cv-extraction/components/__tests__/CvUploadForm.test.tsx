import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * UI de upload/extração/confirmação de CV (USP-040, T15). Cobre: render do
 * input de arquivo; pré-preenchimento marcado como "sugerido pela IA"
 * (CVE-03); fallback gracioso — mensagem amigável + campos vazios editáveis,
 * sem erro disruptivo (CVE-MN-06); confirmação persiste via `confirmCvFields`.
 * As 3 Server Actions são mockadas (import direto do arquivo `'use server'`,
 * mesmo padrão de `CandidateForm.test.tsx`).
 */

const actions = vi.hoisted(() => ({
  uploadCv: vi.fn(),
  extractCvFromUpload: vi.fn(),
  confirmCvFields: vi.fn(),
}));

vi.mock('../../actions/upload-cv', () => ({
  uploadCv: (...a: unknown[]) => actions.uploadCv(...a),
}));
vi.mock('../../actions/extract-cv', () => ({
  extractCvFromUpload: (...a: unknown[]) => actions.extractCvFromUpload(...a),
}));
vi.mock('../../actions/confirm-cv-fields', () => ({
  confirmCvFields: (...a: unknown[]) => actions.confirmCvFields(...a),
}));

const { CvUploadForm } = await import('../CvUploadForm');

function pdfFile(): File {
  return new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' });
}

function selectFile() {
  const input = document.getElementById('cv-file') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [pdfFile()] } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('USP-040 — CvUploadForm', () => {
  it('renderiza o input de upload de arquivo', () => {
    render(<CvUploadForm />);
    expect(screen.getByLabelText(/currículo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar e extrair/i })).toBeInTheDocument();
  });

  it('CVE-03: pré-preenche o formulário e marca os campos como sugeridos pela IA', async () => {
    actions.uploadCv.mockResolvedValue({ ok: true, data: { uploaded: true } });
    actions.extractCvFromUpload.mockResolvedValue({
      ok: true,
      data: {
        fromAi: true,
        fallback: false,
        extracted: {
          educationLevel: 'ENSINO_SUPERIOR',
          educationArea: 'Administração',
          experienceText: '5 anos de experiência',
          skillsText: null,
          coursesText: null,
        },
      },
    });

    render(<CvUploadForm />);
    selectFile();
    fireEvent.click(screen.getByRole('button', { name: /enviar e extrair/i }));

    await waitFor(() => {
      expect(screen.getByText(/sugeridos pela ia/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/área de formação/i)).toHaveValue('Administração');
    expect(screen.getByLabelText(/experiência/i)).toHaveValue('5 anos de experiência');
    expect(actions.uploadCv).toHaveBeenCalledOnce();
    expect(actions.extractCvFromUpload).toHaveBeenCalledOnce();
  });

  it('CVE-MN-06: extração com fallback mostra mensagem amigável e campos vazios editáveis, sem erro disruptivo', async () => {
    actions.uploadCv.mockResolvedValue({ ok: true, data: { uploaded: true } });
    actions.extractCvFromUpload.mockResolvedValue({
      ok: true,
      data: { fromAi: false, fallback: true, extracted: null },
    });

    render(<CvUploadForm />);
    selectFile();
    fireEvent.click(screen.getByRole('button', { name: /enviar e extrair/i }));

    await waitFor(() => {
      expect(screen.getByText(/não conseguimos extrair/i)).toBeInTheDocument();
    });
    // Sem erro disruptivo — nenhum alerta de erro, e o formulário segue editável.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/sugeridos pela ia/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/área de formação/i)).toHaveValue('');
  });

  it('confirma os campos via confirmCvFields após a extração', async () => {
    actions.uploadCv.mockResolvedValue({ ok: true, data: { uploaded: true } });
    actions.extractCvFromUpload.mockResolvedValue({
      ok: true,
      data: {
        fromAi: true,
        fallback: false,
        extracted: {
          educationLevel: 'ENSINO_MEDIO',
          educationArea: null,
          experienceText: null,
          skillsText: null,
          coursesText: null,
        },
      },
    });
    actions.confirmCvFields.mockResolvedValue({ ok: true, data: { confirmed: true } });

    render(<CvUploadForm />);
    selectFile();
    fireEvent.click(screen.getByRole('button', { name: /enviar e extrair/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmar dados do currículo/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /confirmar dados do currículo/i }));

    await waitFor(() => {
      expect(actions.confirmCvFields).toHaveBeenCalledOnce();
    });
    await waitFor(() => {
      expect(screen.getByText(/confirmados/i)).toBeInTheDocument();
    });
  });

  it('exibe o erro do servidor quando o upload falha', async () => {
    actions.uploadCv.mockResolvedValue({
      ok: false,
      error: { code: 'VALIDATION', message: 'Arquivo inválido.' },
    });

    render(<CvUploadForm />);
    selectFile();
    fireEvent.click(screen.getByRole('button', { name: /enviar e extrair/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Arquivo inválido.');
    });
    expect(actions.extractCvFromUpload).not.toHaveBeenCalled();
  });
});
