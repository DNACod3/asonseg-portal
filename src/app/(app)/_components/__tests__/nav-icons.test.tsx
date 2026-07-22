import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { NavIcon } from '../nav-icons';

/**
 * USP-062 — BNAV-04, BNAV-MN-04. Registry de ícones SVG inline: cada href
 * elegível a aba renderiza um `<svg>` com conteúdo próprio (não o
 * fallback); href desconhecido cai no ícone fallback (círculo), sem lançar.
 */

const ELIGIBLE_HREFS = [
  '/inicio',
  '/perfil',
  '/candidato',
  '/prestador',
  '/empresa/cadastrar',
  '/moderacao',
  '/relatorios',
  '/encaminhamentos/novo',
  '/cadastro-assistido',
  '/credenciais/reivindicacoes',
  '/permissoes',
];

describe('NavIcon — ícones elegíveis (BNAV-04)', () => {
  it.each(ELIGIBLE_HREFS)('%s renderiza um ícone próprio (não o fallback)', (href) => {
    const { container } = render(<NavIcon href={href} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    // O fallback não tem <path>; todo ícone mapeado tem pelo menos um.
    expect(svg?.querySelector('path')).not.toBeNull();
  });
});

describe('NavIcon — href desconhecido (fallback, BNAV-04)', () => {
  it('cai no ícone fallback (círculo) sem lançar', () => {
    expect(() => render(<NavIcon href="/rota-nao-mapeada" />)).not.toThrow();
    const { container } = render(<NavIcon href="/rota-nao-mapeada" />);
    const svg = container.querySelector('svg');
    expect(svg?.querySelector('path')).toBeNull();
    expect(svg?.querySelector('circle[r="7"]')).not.toBeNull();
  });
});

describe('NavIcon — a11y (BNAV-04)', () => {
  it('o <svg> é aria-hidden (decorativo — rótulo textual acompanha)', () => {
    const { container } = render(<NavIcon href="/inicio" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
