// Unit do componente cliente da fila (#123 / USP-066) — estados e ramos de UI
// (E-001..E-004, P-003, E-006, P-001, P-004) com as Server Actions mockadas.
// RTL + jsdom.
//
// USP-066/T9 — MUDANÇA DE COMPORTAMENTO INTENCIONAL (não é enfraquecimento de
// teste): "Aprovar" agora exige o conteúdo carregado (novo AC-066-5/P-001).
// Os casos que antes aprovavam sem abrir o conteúdo passam a abrir o painel
// ("Ver conteúdo") antes de clicar em Aprovar — é o comportamento correto sob
// o novo AC, documentado na spec §7 (Must-Not Ownership) e no design §Risks.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const decide = vi.hoisted(() => ({
  approveContent: vi.fn(),
  returnForAdjustments: vi.fn(),
  rejectContent: vi.fn(),
}));
const openContent = vi.hoisted(() => vi.fn());

vi.mock('../../actions/decide', () => ({
  approveContent: (...a: unknown[]) => decide.approveContent(...a),
  returnForAdjustments: (...a: unknown[]) => decide.returnForAdjustments(...a),
  rejectContent: (...a: unknown[]) => decide.rejectContent(...a),
}));

vi.mock('../../actions/open-content', () => ({
  openModerationContent: (...a: unknown[]) => openContent(...a),
}));

const { ModerationQueue } = await import('../moderation-queue');
const { ContentKind } = await import('../../domain/content-status');

const baseRow = {
  contentKind: ContentKind.JOB,
  contentId: 'c1',
  title: 'Vaga de Auxiliar',
  authorName: 'Maria da Silva',
  submittedAtLabel: '01/06/2026 às 09:00',
};
const MOTIVO = 'Faltou descrever as atividades exercidas no cargo anterior';

const jobView = {
  kind: 'JOB',
  title: 'Vaga de Auxiliar',
  description: 'Descrição completa da vaga',
  requirements: null,
  salaryRange: null,
  workRegime: null,
  contractType: null,
  educationLevelRequired: null,
  location: null,
  area: null,
  region: null,
  companyName: 'ACME',
};

beforeEach(() => {
  vi.clearAllMocks();
  decide.approveContent.mockResolvedValue({ ok: true });
  decide.returnForAdjustments.mockResolvedValue({ ok: true });
  decide.rejectContent.mockResolvedValue({ ok: true });
  openContent.mockResolvedValue({ ok: true, data: jobView });
});

/**
 * Abre o painel de conteúdo **do card informado** (escopado via `within` —
 * corrige o achado da PR #294: a versão anterior ignorava o parâmetro e
 * sempre clicava "o" botão da tela via `getByRole`, o que quebra com 2+ itens
 * na fila e mascarava a ausência de sensor multi-item de P-001) e aguarda o
 * carregamento.
 *
 * `expectedText` (default `'ACME'`, o `companyName` de `jobView`) existe para
 * que o próprio helper seja exercitado pelo cenário multi-item (L-023): sem
 * um call site com 2+ cards renderizados passando pelo helper, reverter o
 * `within(row)` para `screen` nunca é pego pela suíte, porque com 1 card
 * `screen` e `within(row)` enxergam o mesmo (único) botão/texto.
 */
async function openContentFor(row: HTMLElement, expectedText = 'ACME') {
  fireEvent.click(within(row).getByRole('button', { name: 'Ver conteúdo' }));
  await waitFor(() => expect(within(row).getByText(expectedText)).toBeInTheDocument());
}

describe('ModerationQueue', () => {
  it('fila vazia (sem decisões): mensagem de fila vazia', () => {
    render(<ModerationQueue items={[]} />);
    expect(screen.getByText(/não há rascunhos aguardando moderação/i)).toBeInTheDocument();
  });

  it('renderiza o item com tipo, título, autor e data; sem badge quando Empresa não marcada', () => {
    const { unmount } = render(<ModerationQueue items={[baseRow]} />);
    expect(screen.getByText('Vaga')).toBeInTheDocument();
    expect(screen.getByText('Vaga de Auxiliar')).toBeInTheDocument();
    expect(screen.getByText(/Maria da Silva/)).toBeInTheDocument();
    expect(screen.queryByText(/empresa não verificada/i)).not.toBeInTheDocument();
    unmount();
  });

  it('badge "Empresa não verificada" aparece quando companyUnverified', () => {
    render(<ModerationQueue items={[{ ...baseRow, companyUnverified: true }]} />);
    expect(screen.getByText(/empresa não verificada/i)).toBeInTheDocument();
  });

  it('autor nulo aparece como travessão', () => {
    render(<ModerationQueue items={[{ ...baseRow, authorName: null }]} />);
    expect(screen.getByText(/Autor:/)).toHaveTextContent('—');
  });

  it('USP-066/P-001: Aprovar nasce desabilitado — o conteúdo ainda não foi aberto', () => {
    render(<ModerationQueue items={[baseRow]} />);
    expect(screen.getByRole('button', { name: /aprovar/i })).toBeDisabled();
  });

  it('USP-066/E-001/P-001: abrir o conteúdo habilita Aprovar; aprovar chama approveContent, remove o item e mostra a confirmação', async () => {
    render(<ModerationQueue items={[baseRow]} />);
    expect(screen.getByRole('button', { name: /aprovar/i })).toBeDisabled();

    await openContentFor(screen.getByRole('listitem'));
    expect(screen.getByRole('button', { name: /aprovar/i })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /aprovar/i }));

    await waitFor(() =>
      expect(decide.approveContent).toHaveBeenCalledWith({
        contentKind: ContentKind.JOB,
        contentId: 'c1',
      }),
    );
    await waitFor(() => expect(screen.getByText(/rascunho\(s\) processado\(s\)/i)).toBeInTheDocument());
  });

  it('USP-066/E-006: carga do conteúdo falha ⇒ Aprovar permanece desabilitado; devolver/rejeitar seguem habilitados', async () => {
    openContent.mockResolvedValue({ ok: false, error: { code: 'NOT_FOUND', message: 'Falhou a carga.' } });
    render(<ModerationQueue items={[baseRow]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ver conteúdo' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Falhou a carga.'));

    expect(screen.getByRole('button', { name: /aprovar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /devolver para ajustes/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /rejeitar/i })).not.toBeDisabled();
  });

  it('devolver: motivo curto bloqueia com erro e NÃO chama a action; motivo válido confirma (sem exigir conteúdo carregado — E-006)', async () => {
    render(<ModerationQueue items={[baseRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /devolver para ajustes/i }));

    const textarea = screen.getByLabelText(/motivo da devolução/i);
    fireEvent.change(textarea, { target: { value: 'curto' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/ao menos 20 caracteres/i));
    expect(decide.returnForAdjustments).not.toHaveBeenCalled();

    fireEvent.change(textarea, { target: { value: MOTIVO } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() =>
      expect(decide.returnForAdjustments).toHaveBeenCalledWith({
        contentKind: ContentKind.JOB,
        contentId: 'c1',
        justification: MOTIVO,
      }),
    );
  });

  it('rejeitar: motivo válido chama rejectContent (sem exigir conteúdo carregado — E-006)', async () => {
    render(<ModerationQueue items={[baseRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /rejeitar/i }));
    fireEvent.change(screen.getByLabelText(/motivo da rejeição/i), { target: { value: MOTIVO } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() =>
      expect(decide.rejectContent).toHaveBeenCalledWith({
        contentKind: ContentKind.JOB,
        contentId: 'c1',
        justification: MOTIVO,
      }),
    );
  });

  it('cancelar fecha o formulário de motivo e volta às ações', () => {
    render(<ModerationQueue items={[baseRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /devolver para ajustes/i }));
    expect(screen.getByLabelText(/motivo da devolução/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(screen.queryByLabelText(/motivo da devolução/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aprovar/i })).toBeInTheDocument();
  });

  it('erro da Server Action de aprovar: mostra o alerta e mantém o item na fila (conteúdo já aberto)', async () => {
    decide.approveContent.mockResolvedValue({ ok: false, error: { message: 'Falhou aqui' } });
    render(<ModerationQueue items={[baseRow]} />);
    await openContentFor(screen.getByRole('listitem'));

    fireEvent.click(screen.getByRole('button', { name: /aprovar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Falhou aqui'));
    // Segue na fila — aparece 2x agora (card + heading do painel de
    // conteúdo carregado, B3/PR#294), daí getAllByText em vez de getByText.
    expect(screen.getAllByText('Vaga de Auxiliar').length).toBeGreaterThan(0);
  });

  it('erro sem mensagem: usa o fallback genérico (conteúdo já aberto)', async () => {
    decide.approveContent.mockResolvedValue({ ok: false });
    render(<ModerationQueue items={[baseRow]} />);
    await openContentFor(screen.getByRole('listitem'));

    fireEvent.click(screen.getByRole('button', { name: /aprovar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível concluir/i));
  });

  it('USP-066/P-004: renderizar a fila com N itens não dispara nenhuma leitura de conteúdo', () => {
    const rows = [
      baseRow,
      { ...baseRow, contentId: 'c2', title: 'Vaga 2' },
      { ...baseRow, contentId: 'c3', title: 'Vaga 3' },
    ];
    render(<ModerationQueue items={rows} />);
    expect(openContent).not.toHaveBeenCalled();
  });

  it('USP-066/P-001 (PR#294 achado #9): contentState é por item — abrir o conteúdo do item B não habilita Aprovar de A/C', async () => {
    // `contentState` é um Record<contentId, estado> — se colapsasse para um
    // booleano global, abrir QUALQUER item habilitaria Aprovar de todos
    // (violação de P-001 mascarada, pois o teste antigo só renderizava 1 item).
    openContent.mockImplementation(async ({ contentId }: { contentId: string }) => ({
      ok: true,
      data: { ...jobView, companyName: `ACME-${contentId}` },
    }));
    const rows = [
      baseRow,
      { ...baseRow, contentId: 'c2', title: 'Vaga 2' },
      { ...baseRow, contentId: 'c3', title: 'Vaga 3' },
    ];
    render(<ModerationQueue items={rows} />);
    const [cardA, cardB, cardC] = screen.getAllByRole('listitem');
    if (!cardA || !cardB || !cardC) throw new Error('esperava 3 cards na fila');

    // Passa pelo helper `openContentFor` (não inline) — é o sensor multi-item
    // de L-023: se o helper voltar a ignorar `row` (usar `screen` em vez de
    // `within(row)`), há 3 botões "Ver conteúdo" na tela e o `getByRole`
    // interno lança "found multiple elements", derrubando este teste.
    await openContentFor(cardB, 'ACME-c2');

    expect(within(cardA).getByRole('button', { name: /aprovar/i })).toBeDisabled();
    expect(within(cardB).getByRole('button', { name: /aprovar/i })).not.toBeDisabled();
    expect(within(cardC).getByRole('button', { name: /aprovar/i })).toBeDisabled();
    expect(openContent).toHaveBeenCalledTimes(1);
    expect(openContent).toHaveBeenCalledWith({ contentKind: ContentKind.JOB, contentId: 'c2' });
  });

  describe('USP-066/A3 (PR#294 achado): gate combinado — checklist da USP-017 + conteúdo carregado', () => {
    const verification = {
      companyId: 'comp-1',
      cnpj: '00.000.000/0001-00',
      razaoSocial: 'ACME Ltda',
      nomeFantasia: 'ACME',
      setor: 'Serviços',
      endereco: null,
      isVerified: false,
      verifiedAtLabel: null,
      verifiedByName: null,
      rejectionCount: 0,
      changedSinceVerification: [],
      rejections: [],
    };
    const CHECKLIST_ITEMS = [{ id: 'item-unico', label: 'Item único de verificação' }];

    it('conteúdo carregado + checklist incompleta ⇒ Aprovar segue desabilitado, título traz a mensagem da checklist', async () => {
      render(
        <ModerationQueue items={[{ ...baseRow, verification }]} checklistItems={CHECKLIST_ITEMS} />,
      );
      await openContentFor(screen.getByRole('listitem'));

      const approveBtn = screen.getByRole('button', { name: /aprovar/i });
      expect(approveBtn).toBeDisabled();
      expect(approveBtn).toHaveAttribute(
        'title',
        'Conclua a checklist de verificação da Empresa para aprovar (P-001).',
      );
    });

    it('conteúdo carregado + checklist concluída ⇒ Aprovar habilita', async () => {
      render(
        <ModerationQueue items={[{ ...baseRow, verification }]} checklistItems={CHECKLIST_ITEMS} />,
      );
      await openContentFor(screen.getByRole('listitem'));

      fireEvent.click(screen.getByRole('checkbox', { name: /item único de verificação/i }));

      const approveBtn = screen.getByRole('button', { name: /aprovar/i });
      await waitFor(() => expect(approveBtn).not.toBeDisabled());
      expect(approveBtn).not.toHaveAttribute('title');
    });
  });

  it('A2 (PR#294): item CV (sem reader registrado) não exige conteúdo carregado — Aprovar não trava para sempre', () => {
    const cvRow = { ...baseRow, contentId: 'cv-1', contentKind: ContentKind.CV, title: 'CV de Auxiliar' };
    render(<ModerationQueue items={[cvRow]} />);

    // CV não tem ContentModerationReader (sem model real) — não há painel
    // "Ver conteúdo" para ele, e Aprovar não pode ficar permanentemente
    // desabilitado esperando um carregamento que nunca vai acontecer.
    expect(screen.queryByRole('button', { name: 'Ver conteúdo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aprovar/i })).not.toBeDisabled();
  });
});

describe('ModerationQueue — gating de ações por permissão (USP-056/MOD-7)', () => {
  const cvRow = { ...baseRow, contentId: 'cv-1', contentKind: ContentKind.CV, title: 'CV de Auxiliar' };

  it('[USP056-MN-04] item CV com viewerModeratableKinds=[JOB] não exibe ações acionáveis', () => {
    render(<ModerationQueue items={[cvRow]} viewerModeratableKinds={[ContentKind.JOB]} />);

    expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /devolver para ajustes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rejeitar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver conteúdo' })).not.toBeInTheDocument();
    expect(screen.getByText(/não tem permissão para moderar este tipo/i)).toBeInTheDocument();
  });

  it('[MOD7-03] item JOB com viewerModeratableKinds=[JOB] exibe as ações normalmente', () => {
    render(<ModerationQueue items={[baseRow]} viewerModeratableKinds={[ContentKind.JOB]} />);

    expect(screen.getByRole('button', { name: /aprovar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /devolver para ajustes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rejeitar/i })).toBeInTheDocument();
  });

  it('[MOD7-03] prop ausente (coordenador) → todas as ações disponíveis para qualquer tipo, sem regressão', () => {
    render(<ModerationQueue items={[cvRow]} />);

    expect(screen.getByRole('button', { name: /aprovar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /devolver para ajustes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rejeitar/i })).toBeInTheDocument();
    expect(screen.queryByText(/não tem permissão para moderar este tipo/i)).not.toBeInTheDocument();
  });

  it('[MOD7-03] viewerModeratableKinds com todos os kinds → todas as ações disponíveis', () => {
    render(
      <ModerationQueue
        items={[cvRow]}
        viewerModeratableKinds={[ContentKind.JOB, ContentKind.SERVICE, ContentKind.CV, ContentKind.CANDIDATE_PROFILE]}
      />,
    );

    expect(screen.getByRole('button', { name: /aprovar/i })).toBeInTheDocument();
  });
});
