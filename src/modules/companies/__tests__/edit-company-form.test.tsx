import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Testes de UI do formulário de edição de Empresa (USP-015 / #142). Cobre:
 * mudança não-identitária submete direto (sem diálogo); mudança identitária
 * (D-015-E) exige confirmação no diálogo de re-verificação antes de chamar a
 * action. A Server Action e o router são mockados; schema Zod é o real.
 */

const actionState = vi.hoisted(() => ({ editarEmpresa: vi.fn() }));
const routerState = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));

vi.mock('../actions/edit-company', () => ({
  editarEmpresa: (...a: unknown[]) => actionState.editarEmpresa(...a),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerState.refresh, push: routerState.push }),
}));

const { EditCompanyForm } = await import('../components/edit-company-form');

const EMPRESA = {
  id: '11111111-1111-4111-8111-111111111111',
  cnpj: '11222333000181',
  type: 'SIMPLES_NACIONAL' as const,
  razaoSocial: 'Padaria Aurora Alimentos Ltda',
  nomeFantasia: 'Padaria Aurora',
  setor: 'Alimentação',
  descricao: 'Pães',
  endereco: 'Rua das Flores, 100',
  isVerified: true,
};

function renderForm(overrides: Partial<typeof EMPRESA> = {}) {
  return render(<EditCompanyForm empresa={{ ...EMPRESA, ...overrides }} />);
}

const salvar = () => fireEvent.click(screen.getByRole('button', { name: /salvar alterações/i }));

beforeEach(() => {
  vi.clearAllMocks();
  actionState.editarEmpresa.mockResolvedValue({
    ok: true,
    data: { companyId: EMPRESA.id, isVerified: true, downgraded: false },
  });
});

describe('EditCompanyForm (USP-015)', () => {
  it('EMP055-05/EMP055-MN-02: renderiza os 5 radios de Tipo (incl. SA, LUCRO_PRESUMIDO, LUCRO_REAL)', () => {
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

  it('EMP055-07: pré-seleciona o radio de defaultValues.type (SA) sem rebaixar ao renderizar', () => {
    renderForm({ type: 'SA' });
    expect(screen.getByRole('radio', { name: /sociedade anônima/i })).toBeChecked();
  });

  it('mudança não-identitária (descrição) submete direto, sem diálogo', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/descrição/i), {
      target: { value: 'Pães artesanais e cafés' },
    });
    salvar();

    await waitFor(() => expect(actionState.editarEmpresa).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(actionState.editarEmpresa).toHaveBeenCalledWith(
      expect.objectContaining({ descricao: 'Pães artesanais e cafés' }),
    );
  });

  it('mudança identitária (nome fantasia) abre diálogo de re-verificação antes de enviar', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/nome fantasia/i), {
      target: { value: 'Padaria Aurora & Cia' },
    });
    salvar();

    // Não chamou a action ainda — aguarda confirmação.
    expect(actionState.editarEmpresa).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/nova verificação manual/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /confirmar e salvar/i }));
    await waitFor(() => expect(actionState.editarEmpresa).toHaveBeenCalledTimes(1));
    expect(actionState.editarEmpresa).toHaveBeenCalledWith(
      expect.objectContaining({ nomeFantasia: 'Padaria Aurora & Cia' }),
    );
  });

  it('cancelar o diálogo não envia a edição', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/razão social/i), {
      target: { value: 'Outra Razão Social Ltda' },
    });
    salvar();

    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(actionState.editarEmpresa).not.toHaveBeenCalled();
  });

  it('mudança identitária em Empresa não-verificada submete direto (nada a rebaixar)', async () => {
    renderForm({ isVerified: false });
    fireEvent.change(screen.getByLabelText(/nome fantasia/i), {
      target: { value: 'Padaria Aurora & Cia' },
    });
    salvar();

    await waitFor(() => expect(actionState.editarEmpresa).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('exibe a mensagem de erro do servidor (ex.: CONFLICT)', async () => {
    actionState.editarEmpresa.mockResolvedValue({
      ok: false,
      error: { code: 'CONFLICT', message: 'Este CNPJ já está cadastrado em outra Empresa.' },
    });
    renderForm();
    fireEvent.change(screen.getByLabelText(/descrição/i), { target: { value: 'novo texto' } });
    salvar();

    expect(await screen.findByRole('alert')).toHaveTextContent(/já está cadastrado/i);
  });
});
