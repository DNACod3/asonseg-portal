import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { parseTermMarkdown, TermMarkdown } from '../term-markdown';

/**
 * USP-059 — AUTH-6/EMP-7: renderer mínimo de Markdown de termos.
 * `parseTermMarkdown` (função pura) é testado 1:1 por construto; `TermMarkdown`
 * (componente) confirma que a sintaxe não aparece crua no output (AUTH6-2) e
 * que HTML-like nunca vira elemento real (CASCA59-MN-04).
 */

describe('parseTermMarkdown — 1:1 por construto (AUTH6-1)', () => {
  it('H1 (`#`)', () => {
    expect(parseTermMarkdown('# Termo de Consentimento')).toEqual([
      { type: 'heading1', spans: [{ type: 'text', value: 'Termo de Consentimento' }] },
    ]);
  });

  it('H2 (`##`)', () => {
    expect(parseTermMarkdown('## O que será tratado')).toEqual([
      { type: 'heading2', spans: [{ type: 'text', value: 'O que será tratado' }] },
    ]);
  });

  it('negrito (`**`)', () => {
    expect(parseTermMarkdown('A **ASONSEG** solicita.')).toEqual([
      {
        type: 'paragraph',
        spans: [
          { type: 'text', value: 'A ' },
          { type: 'bold', value: 'ASONSEG' },
          { type: 'text', value: ' solicita.' },
        ],
      },
    ]);
  });

  it('lista (`- `)', () => {
    expect(parseTermMarkdown('- Item um\n- Item dois')).toEqual([
      {
        type: 'list',
        items: [
          [{ type: 'text', value: 'Item um' }],
          [{ type: 'text', value: 'Item dois' }],
        ],
      },
    ]);
  });

  it('lista com linha de continuação (quebra visual do mesmo item)', () => {
    expect(parseTermMarkdown('- Item que quebra\n  na linha seguinte')).toEqual([
      { type: 'list', items: [[{ type: 'text', value: 'Item que quebra na linha seguinte' }]] },
    ]);
  });

  it('citação (`> `)', () => {
    expect(parseTermMarkdown('> Documento versionado.')).toEqual([
      { type: 'blockquote', spans: [{ type: 'text', value: 'Documento versionado.' }] },
    ]);
  });

  it('citação em múltiplas linhas é unificada em um bloco', () => {
    expect(parseTermMarkdown('> Linha um\n> linha dois')).toEqual([
      { type: 'blockquote', spans: [{ type: 'text', value: 'Linha um linha dois' }] },
    ]);
  });

  it('régua horizontal (`---`)', () => {
    expect(parseTermMarkdown('---')).toEqual([{ type: 'hr' }]);
  });

  it('código inline (`` ` ``)', () => {
    expect(parseTermMarkdown('Veja `legal/consent-terms/job-application/v1.0.md`.')).toEqual([
      {
        type: 'paragraph',
        spans: [
          { type: 'text', value: 'Veja ' },
          { type: 'code', value: 'legal/consent-terms/job-application/v1.0.md' },
          { type: 'text', value: '.' },
        ],
      },
    ]);
  });

  it('parágrafo simples', () => {
    expect(parseTermMarkdown('Texto simples sem construto.')).toEqual([
      { type: 'paragraph', spans: [{ type: 'text', value: 'Texto simples sem construto.' }] },
    ]);
  });

  it('parágrafos separados por linha em branco viram blocos distintos', () => {
    expect(parseTermMarkdown('Primeiro parágrafo.\n\nSegundo parágrafo.')).toEqual([
      { type: 'paragraph', spans: [{ type: 'text', value: 'Primeiro parágrafo.' }] },
      { type: 'paragraph', spans: [{ type: 'text', value: 'Segundo parágrafo.' }] },
    ]);
  });

  it('AUTH6-3: construto não suportado (H3) degrada a parágrafo de texto inerte, sem lançar', () => {
    expect(() => parseTermMarkdown('### Não suportado')).not.toThrow();
    expect(parseTermMarkdown('### Não suportado')).toEqual([
      { type: 'paragraph', spans: [{ type: 'text', value: '### Não suportado' }] },
    ]);
  });

  it('EC-2: corpo indisponível (TERM_BODY_UNAVAILABLE) renderiza como parágrafo', () => {
    const fallback = 'Não foi possível carregar o texto desta versão do termo.';
    expect(parseTermMarkdown(fallback)).toEqual([
      { type: 'paragraph', spans: [{ type: 'text', value: fallback }] },
    ]);
  });
});

describe('TermMarkdown — sintaxe não aparece crua no output (AUTH6-2)', () => {
  it('renderiza <h1>/<h2>/<strong>/<ul><li>/<blockquote>/<hr>/<code> a partir de um termo real', () => {
    const source = [
      '# Termo de Consentimento',
      '',
      '**Finalidade** de teste.',
      '',
      '## Seção',
      '',
      '- Item um',
      '- Item dois',
      '',
      '> Citação de rodapé.',
      '',
      '---',
      '',
      'Veja `consent-terms`.',
    ].join('\n');

    render(<TermMarkdown source={source} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Termo de Consentimento' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Seção' })).toBeInTheDocument();
    expect(screen.getByText('Finalidade').tagName).toBe('STRONG');
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Citação de rodapé.').closest('blockquote')).not.toBeNull();
    expect(document.querySelector('hr')).not.toBeNull();
    expect(screen.getByText('consent-terms').tagName).toBe('CODE');

    // Nenhuma marcação de sintaxe aparece como texto literal.
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('# Termo de Consentimento');
    expect(text).not.toContain('**Finalidade**');
    expect(text).not.toContain('- Item um');
    expect(text).not.toContain('> Citação');
    expect(text).not.toMatch(/`consent-terms`/);
  });
});

describe('CASCA59-MN-04 — HTML-like no corpo do termo nunca vira elemento real', () => {
  it('input com <script>/<b> renderiza como texto literal, sem elemento <script>/<b> no DOM', () => {
    const { container } = render(
      <TermMarkdown source={'Aviso: <script>alert(1)</script> e <b>negrito falso</b>.'} />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
    expect(container.textContent).toContain('<b>negrito falso</b>');
  });
});
