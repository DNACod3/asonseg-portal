import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../badge';

/**
 * Fundação de Design System da Fase 1 — T10 (DS-10).
 */
describe('Badge', () => {
  it('variant=blue aplica text-primary (token)', () => {
    render(<Badge variant="blue">Nova</Badge>);
    expect(screen.getByText('Nova').className).toContain('text-primary');
  });

  it('variant=orange aplica text-cta (token)', () => {
    render(<Badge variant="orange">Urgente</Badge>);
    expect(screen.getByText('Urgente').className).toContain('text-cta');
  });

  it('variant=green aplica text-success (token)', () => {
    render(<Badge variant="green">Aprovado</Badge>);
    expect(screen.getByText('Aprovado').className).toContain('text-success');
  });

  it('variant=gray aplica text-fg-muted (token)', () => {
    render(<Badge variant="gray">Arquivado</Badge>);
    expect(screen.getByText('Arquivado').className).toContain('text-fg-muted');
  });

  it('renderiza sob data-theme="dark" mantendo as classes de token', () => {
    document.documentElement.dataset.theme = 'dark';
    render(<Badge variant="blue">Nova</Badge>);
    expect(screen.getByText('Nova').className).toContain('text-primary');
    delete document.documentElement.dataset.theme;
  });
});
