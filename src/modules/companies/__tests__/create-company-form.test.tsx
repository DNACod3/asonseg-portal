import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Testes de UI do formulário de cadastro de Empresa (USP-012, Fase 2 restyle).
 * Cobre o gate afirmativo do consentimento (submit não chama `createCompany`
 * sem marcar o termo) e a chamada preservada da action quando o consentimento
 * é marcado e os dados são válidos. A Server Action e o router são mockados;
 * o schema Zod é o real.
 */

const actionState = vi.hoisted(() => ({ createCompany: vi.fn() }));
const routerState = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));

vi.mock('../actions/create-company', () => ({
  createCompany: (...a: unknown[]) => actionState.createCompany(...a),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerState.refresh, push: routerState.push }),
}));

const { CreateCompanyForm } = await import('../components/create-company-form');

const TERM = {
  version: 'v1.0',
  contentHash: 'e72b433324098c03e7800f4e71b64605bf7153b914e24f869e74e944835e1200',
  body: 'Termo de representação empresarial — corpo de teste.',
};

function renderForm() {
  return render(<CreateCompanyForm term={TERM} />);
}

function fillValidData() {
  fireEvent.change(screen.getByLabelText(/^cnpj$/i), { target: { value: '11222333000181' } });
  fireEvent.change(screen.getByLabelText(/razão social/i), {
    target: { value: 'Padaria Aurora Alimentos Ltda' },
  });
  fireEvent.change(screen.getByLabelText(/nome fantasia/i), {
    target: { value: 'Padaria Aurora' },
  });
  fireEvent.change(screen.getByLabelText(/^setor$/i), { target: { value: 'Alimentação' } });
}

const cadastrar = () =>
  fireEvent.click(screen.getByRole('button', { name: /cadastrar empresa/i }));

beforeEach(() => {
  vi.clearAllMocks();
  actionState.createCompany.mockResolvedValue({
    ok: true,
    data: { companyId: 'c-1', cnpj: '11222333000181', razaoSocial: 'Padaria Aurora Alimentos Ltda' },
  });
});

describe('CreateCompanyForm (USP-012, restyle Fase 2)', () => {
  it('EMP055-06/EMP055-MN-02: renderiza os 5 radios de Tipo (incl. SA, LUCRO_PRESUMIDO, LUCRO_REAL)', () => {
    renderForm();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual([
      'MEI',
      'SIMPLES_NACIONAL',
      'LUCRO_PRESUMIDO',
      'LUCRO_REAL',
      'SA',
    ]);
  });

  it('EMP055-06: mantém SIMPLES_NACIONAL como default de criação', () => {
    renderForm();
    expect(screen.getByRole('radio', { name: /^simples nacional$/i })).toBeChecked();
  });

  it('renderiza os campos e o botão de submit usando os primitivos do DS', () => {
    renderForm();
    expect(screen.getByLabelText(/^cnpj$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/razão social/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nome fantasia/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^setor$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cadastrar empresa/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /termo de representação empresarial/i }),
    ).toBeInTheDocument();
  });

  it('AUTH6-4: renderiza o corpo do termo via TermMarkdown — sem sintaxe Markdown crua', () => {
    render(
      <CreateCompanyForm term={{ ...TERM, body: '**Finalidade** do termo empresarial.' }} />,
    );
    expect(screen.getByText('Finalidade').tagName).toBe('STRONG');
    expect(screen.queryByText(/\*\*Finalidade\*\*/)).not.toBeInTheDocument();
  });

  it('submeter sem marcar o consentimento NÃO chama createCompany', async () => {
    renderForm();
    fillValidData();
    cadastrar();

    // Dá tempo pro handler (async, via RHF) rodar antes de afirmar a ausência da chamada.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(actionState.createCompany).not.toHaveBeenCalled();
  });

  it('marcar o consentimento + dados válidos chama createCompany uma vez', async () => {
    renderForm();
    fillValidData();
    fireEvent.click(screen.getByRole('checkbox'));
    cadastrar();

    await waitFor(() => expect(actionState.createCompany).toHaveBeenCalledTimes(1));
    expect(actionState.createCompany).toHaveBeenCalledWith(
      expect.objectContaining({
        companyRepresentationTermVersion: TERM.version,
        companyRepresentationTermHash: TERM.contentHash,
      }),
    );
  });

  it('sucesso redireciona para /empresa/{companyId}/responsaveis', async () => {
    renderForm();
    fillValidData();
    fireEvent.click(screen.getByRole('checkbox'));
    cadastrar();

    await waitFor(() => expect(routerState.push).toHaveBeenCalledWith('/empresa/c-1/responsaveis'));
  });

  it('exibe a mensagem de erro do servidor (ex.: CONFLICT)', async () => {
    actionState.createCompany.mockResolvedValue({
      ok: false,
      error: { code: 'CONFLICT', message: 'Este CNPJ já está cadastrado no portal.' },
    });
    renderForm();
    fillValidData();
    fireEvent.click(screen.getByRole('checkbox'));
    cadastrar();

    expect(await screen.findByText(/já está cadastrado/i)).toBeInTheDocument();
  });
});
