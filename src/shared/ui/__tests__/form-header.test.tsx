import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormHeader } from '../form-header';
import { StepIcon } from '../step-icon';

/**
 * Fundação de Design System da Fase 1 — T7 (DS-08, DS-11 parcial).
 */
describe('FormHeader', () => {
  it('renderiza title como h1 com font-heading', () => {
    render(<FormHeader title="Cadastro" />);
    const h1 = screen.getByRole('heading', { name: 'Cadastro', level: 1 });
    expect(h1.className).toContain('font-heading');
  });

  it('renderiza description quando fornecida', () => {
    render(<FormHeader title="Cadastro" description="Preencha os dados abaixo" />);
    expect(screen.getByText('Preencha os dados abaixo')).toBeInTheDocument();
  });

  it('omite o parágrafo de description quando não fornecida', () => {
    render(<FormHeader title="Cadastro" />);
    expect(screen.queryByText(/preencha/i)).not.toBeInTheDocument();
  });
});

describe('StepIcon', () => {
  it('variant=blue aplica text-primary (token)', () => {
    render(
      <StepIcon variant="blue" data-testid="icon">
        1
      </StepIcon>,
    );
    expect(screen.getByTestId('icon').className).toContain('text-primary');
  });

  it('variant=orange aplica text-cta (token)', () => {
    render(
      <StepIcon variant="orange" data-testid="icon">
        2
      </StepIcon>,
    );
    expect(screen.getByTestId('icon').className).toContain('text-cta');
  });

  it('variant=green aplica text-success (token)', () => {
    render(
      <StepIcon variant="green" data-testid="icon">
        3
      </StepIcon>,
    );
    expect(screen.getByTestId('icon').className).toContain('text-success');
  });

  it('renderiza sob data-theme="dark" mantendo as classes de token (re-resolução automática)', () => {
    document.documentElement.dataset.theme = 'dark';
    render(
      <StepIcon variant="blue" data-testid="icon">
        1
      </StepIcon>,
    );
    expect(screen.getByTestId('icon').className).toContain('text-primary');
    delete document.documentElement.dataset.theme;
  });
});
