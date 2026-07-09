import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * UI da ficha socioeconômica (USP-036 / AC-036-1, T7). Cobre: render dos 4
 * campos declarados e exibição de erro de validação client-side. O caminho de
 * submissão bem-sucedida (persistência/auditoria) é coberto pelo teste de
 * integração da action (`save-socioeconomic-record.int.test.ts`) — aqui só a UI.
 *
 * "Não importa Prisma no bundle client": garantido estruturalmente (import
 * direto do arquivo `'use server'`, não do barrel — ver comentário no
 * componente) e verificado de fato pelo gate de build de produção
 * (`NODE_ENV=production npm run build`), não por este teste unitário.
 */

const actions = vi.hoisted(() => ({ saveSocioeconomicRecord: vi.fn() }));

// O form importa a action direto do arquivo `'use server'` via caminho relativo
// (não do barrel) — o mock segue o path (mesmo padrão de CandidateForm.test.tsx).
vi.mock('../actions/save-socioeconomic-record', () => ({
  saveSocioeconomicRecord: (...a: unknown[]) => actions.saveSocioeconomicRecord(...a),
}));

const { SocioeconomicRecordForm } = await import('../components/socioeconomic-record-form');

const PERSON_ID = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  vi.clearAllMocks();
  actions.saveSocioeconomicRecord.mockResolvedValue({ ok: true, data: { personId: PERSON_ID } });
});

describe('USP-036 T7 — SocioeconomicRecordForm', () => {
  it('renderiza os 4 campos declarados (AC-036-1)', () => {
    render(<SocioeconomicRecordForm personId={PERSON_ID} />);
    expect(screen.getByLabelText(/renda aproximada/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/benefício social recebido/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/situação de moradia/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/composição familiar declarada/i)).toBeInTheDocument();
  });

  it('pré-preenche com os valores de `initial` quando fornecido', () => {
    render(
      <SocioeconomicRecordForm
        personId={PERSON_ID}
        initial={{
          incomeBracket: 'UP_TO_1_MW',
          socialBenefit: 'Bolsa Família',
          housingSituation: 'RENTED',
          familyComposition: '4 pessoas',
        }}
      />,
    );
    expect(screen.getByLabelText(/benefício social recebido/i)).toHaveValue('Bolsa Família');
    expect(screen.getByLabelText(/composição familiar declarada/i)).toHaveValue('4 pessoas');
    expect(screen.getByLabelText(/renda aproximada/i)).toHaveValue('UP_TO_1_MW');
    expect(screen.getByLabelText(/situação de moradia/i)).toHaveValue('RENTED');
  });

  it('submit inválido (benefício acima do limite) mostra erro de validação e não chama a action', async () => {
    render(<SocioeconomicRecordForm personId={PERSON_ID} />);
    fireEvent.change(screen.getByLabelText(/benefício social recebido/i), {
      target: { value: 'a'.repeat(201) },
    });
    fireEvent.click(screen.getByRole('button', { name: /salvar ficha/i }));

    await waitFor(() => {
      expect(screen.getByText(/máximo de 200 caracteres/i)).toBeInTheDocument();
    });
    expect(actions.saveSocioeconomicRecord).not.toHaveBeenCalled();
  });

  it('submit válido chama a action com o personId e exibe confirmação de sucesso', async () => {
    render(<SocioeconomicRecordForm personId={PERSON_ID} />);
    fireEvent.change(screen.getByLabelText(/benefício social recebido/i), {
      target: { value: 'Bolsa Família' },
    });
    fireEvent.click(screen.getByRole('button', { name: /salvar ficha/i }));

    await waitFor(() => {
      expect(actions.saveSocioeconomicRecord).toHaveBeenCalledWith(
        expect.objectContaining({ personId: PERSON_ID, socialBenefit: 'Bolsa Família' }),
      );
    });
    expect(await screen.findByText(/ficha salva com sucesso/i)).toBeInTheDocument();
  });
});
