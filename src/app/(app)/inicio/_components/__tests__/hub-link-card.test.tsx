import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HubLinkCard } from '../hub-link-card';

describe('HubLinkCard', () => {
  it('renderiza label, descrição e href do link', () => {
    render(
      <HubLinkCard
        link={{ href: '/candidato', label: 'Área do candidato', description: 'Currículo e vagas.' }}
      />,
    );

    expect(screen.getByText('Área do candidato')).toBeInTheDocument();
    expect(screen.getByText('Currículo e vagas.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Área do candidato/ })).toHaveAttribute(
      'href',
      '/candidato',
    );
  });
});
