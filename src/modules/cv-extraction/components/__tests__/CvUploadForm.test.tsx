import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * UI de upload/extração/confirmação de CV (USP-040, T15; CAND-6). Cobre: render do
 * input de arquivo; pré-preenchimento marcado como "sugerido pela IA"
 * (CVE-03); fallback gracioso — mensagem amigável + campos vazios editáveis,
 * sem erro disruptivo (CVE-MN-06); confirmação persiste via `confirmCvFields`;
 * gate de aceite do termo CV_AI_EXTRACTION antes do upload (PERF-05/05b/05c,
 * PERF-MN-03). As Server Actions são mockadas (import direto do arquivo
 * `'use server'`, mesmo padrão de `CandidateForm.test.tsx`).
 */

const actions = vi.hoisted(() => ({
  uploadCv: vi.fn(),
  extractCvFromUpload: vi.fn(),
  confirmCvFields: vi.fn(),
  grantConsent: vi.fn(),
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
vi.mock('@/modules/consents/actions/grant-consent', () => ({
  grantConsent: (...a: unknown[]) => actions.grantConsent(...a),
}));

const { CvUploadForm } = await import('../CvUploadForm');

const cvTerm = { version: 'v1.0', contentHash: 'hash', body: 'TERMO: extração de currículo por IA.' };
/** Props padrão dos testes preexistentes (fluxo USP-040 intacto): consentimento já ativo, sem gate. */
const grantedProps = { term: cvTerm, alreadyGranted: true };

function pdfFile(): File {
  return new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' });
}

function selectFile() {
  const input = document.getElementById('cv-file') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [pdfFile()] } });
}

/** Arquivo com `size` acima do limite de 5 MB (CVE-01) sem alocar bytes reais. */
function oversizedFile(): File {
  const file = pdfFile();
  Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 });
  return file;
}

function selectOversizedFile() {
  const input = document.getElementById('cv-file') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [oversizedFile()] } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('USP-040 — CvUploadForm', () => {
  it('renderiza o input de upload de arquivo', () => {
    render(<CvUploadForm {...grantedProps} />);
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

    render(<CvUploadForm {...grantedProps} />);
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

    render(<CvUploadForm {...grantedProps} />);
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

    render(<CvUploadForm {...grantedProps} />);
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

  // CAND-5 / RF-05 / RF-MN-04: CV acima do limite é barrado no cliente, sem
  // despachar a Server Action `uploadCv` (evita o erro de transporte 413).
  it('RF-MN-04: CV > 5 MB não chama uploadCv e exibe mensagem PT-BR de tamanho', async () => {
    render(<CvUploadForm {...grantedProps} />);
    selectOversizedFile();
    fireEvent.click(screen.getByRole('button', { name: /enviar e extrair/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'O arquivo excede o limite de 5 MB. Envie um currículo menor.',
      );
    });
    expect(actions.uploadCv).not.toHaveBeenCalled();
  });

  it('CV dentro do limite (≤ 5 MB) chama uploadCv normalmente', async () => {
    actions.uploadCv.mockResolvedValue({ ok: true, data: { uploaded: true } });
    actions.extractCvFromUpload.mockResolvedValue({
      ok: true,
      data: { fromAi: false, fallback: true, extracted: null },
    });

    render(<CvUploadForm {...grantedProps} />);
    selectFile();
    fireEvent.click(screen.getByRole('button', { name: /enviar e extrair/i }));

    await waitFor(() => expect(actions.uploadCv).toHaveBeenCalledOnce());
  });

  it('exibe o erro do servidor quando o upload falha', async () => {
    actions.uploadCv.mockResolvedValue({
      ok: false,
      error: { code: 'VALIDATION', message: 'Arquivo inválido.' },
    });

    render(<CvUploadForm {...grantedProps} />);
    selectFile();
    fireEvent.click(screen.getByRole('button', { name: /enviar e extrair/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Arquivo inválido.');
    });
    expect(actions.extractCvFromUpload).not.toHaveBeenCalled();
  });

  describe('CAND-6 — gate de aceite do termo CV_AI_EXTRACTION', () => {
    it('PERF-05: sem consentimento ativo, exibe o termo e desabilita o envio até o aceite', () => {
      render(<CvUploadForm term={cvTerm} alreadyGranted={false} />);
      expect(screen.getByText(/TERMO: extração de currículo por IA/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /enviar e extrair/i })).toBeDisabled();
    });

    it('AUTH6-4: renderiza o corpo do termo via TermMarkdown — sem sintaxe Markdown crua', () => {
      render(
        <CvUploadForm
          term={{ ...cvTerm, body: '**Finalidade** do termo de extração.' }}
          alreadyGranted={false}
        />,
      );
      expect(screen.getByText('Finalidade').tagName).toBe('STRONG');
      expect(screen.queryByText(/\*\*Finalidade\*\*/)).not.toBeInTheDocument();
    });

    it('PERF-MN-03: checkbox desmarcado + alreadyGranted=false → clicar não despacha uploadCv nem grantConsent', () => {
      render(<CvUploadForm term={cvTerm} alreadyGranted={false} />);
      selectFile();
      fireEvent.click(screen.getByRole('button', { name: /enviar e extrair/i }));

      expect(actions.grantConsent).not.toHaveBeenCalled();
      expect(actions.uploadCv).not.toHaveBeenCalled();
    });

    it('PERF-05: ao aceitar o termo, o envio habilita e grantConsent é chamado antes de uploadCv', async () => {
      actions.grantConsent.mockResolvedValue({
        ok: true,
        data: {
          consentId: 'c1',
          purpose: 'CV_AI_EXTRACTION',
          termVersion: 'v1.0',
          alreadyActive: false,
          roleReactivated: false,
        },
      });
      actions.uploadCv.mockResolvedValue({ ok: true, data: { uploaded: true } });
      actions.extractCvFromUpload.mockResolvedValue({
        ok: true,
        data: { fromAi: false, fallback: true, extracted: null },
      });

      render(<CvUploadForm term={cvTerm} alreadyGranted={false} />);
      fireEvent.click(screen.getByRole('checkbox'));
      expect(screen.getByRole('button', { name: /enviar e extrair/i })).toBeEnabled();

      selectFile();
      fireEvent.click(screen.getByRole('button', { name: /enviar e extrair/i }));

      await waitFor(() => expect(actions.uploadCv).toHaveBeenCalledOnce());
      expect(actions.grantConsent).toHaveBeenCalledWith({ purpose: 'CV_AI_EXTRACTION' });
      // Ordem: grantConsent ANTES de uploadCv (CAND-6 / CVE-MN-03). Ambos os
      // mocks já foram confirmados chamados acima — os índices existem.
      const [grantOrder] = actions.grantConsent.mock.invocationCallOrder;
      const [uploadOrder] = actions.uploadCv.mock.invocationCallOrder;
      expect(grantOrder).toBeDefined();
      expect(uploadOrder).toBeDefined();
      expect(grantOrder as number).toBeLessThan(uploadOrder as number);
    });

    it('PERF-05c: grantConsent falha → exibe erro PT-BR e não chama uploadCv', async () => {
      actions.grantConsent.mockResolvedValue({
        ok: false,
        error: { code: 'PRECONDITION_FAILED', message: 'Termo desta finalidade indisponível no momento.' },
      });

      render(<CvUploadForm term={cvTerm} alreadyGranted={false} />);
      fireEvent.click(screen.getByRole('checkbox'));
      selectFile();
      fireEvent.click(screen.getByRole('button', { name: /enviar e extrair/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Termo desta finalidade indisponível no momento.');
      });
      expect(actions.uploadCv).not.toHaveBeenCalled();
    });

    it('PERF-05b: com consentimento já ativo, não exibe o termo e sobe direto ao upload', async () => {
      actions.uploadCv.mockResolvedValue({ ok: true, data: { uploaded: true } });
      actions.extractCvFromUpload.mockResolvedValue({
        ok: true,
        data: { fromAi: false, fallback: true, extracted: null },
      });

      render(<CvUploadForm {...grantedProps} />);
      expect(screen.queryByText(/TERMO: extração de currículo por IA/)).not.toBeInTheDocument();
      selectFile();
      fireEvent.click(screen.getByRole('button', { name: /enviar e extrair/i }));

      await waitFor(() => expect(actions.uploadCv).toHaveBeenCalledOnce());
      expect(actions.grantConsent).not.toHaveBeenCalled();
    });

    it('QUANDO o termo está indisponível (term=null) e o consentimento não está ativo, desabilita o upload com aviso', () => {
      render(<CvUploadForm term={null} alreadyGranted={false} />);
      expect(screen.getByRole('alert')).toHaveTextContent(
        /termo de extração de currículo por ia indisponível/i,
      );
      expect(screen.getByRole('button', { name: /enviar e extrair/i })).toBeDisabled();
    });
  });
});
