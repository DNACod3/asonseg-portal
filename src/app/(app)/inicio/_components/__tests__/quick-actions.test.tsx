import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuickActions } from '../quick-actions';

/** USP-067 — T10 / PNL-00. */
describe('QuickActions', () => {
  it('renderiza um link por ação, com o href correto', () => {
    render(
      <QuickActions
        actions={[
          { label: 'Publicar vaga', href: '/empresa/1/vagas/nova', variant: 'primary' },
          { label: 'Ver candidatos', href: '/empresa/1/vagas', variant: 'outline' },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Publicar vaga' })).toHaveAttribute(
      'href',
      '/empresa/1/vagas/nova',
    );
    expect(screen.getByRole('link', { name: 'Ver candidatos' })).toHaveAttribute(
      'href',
      '/empresa/1/vagas',
    );
  });

  it('sem ações: não renderiza nada', () => {
    const { container } = render(<QuickActions actions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
