import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '../card';
import { FormCard, FormSectionTitle } from '../form-card';

/**
 * Fundação de Design System da Fase 1 — T6 (DS-11 parcial).
 */
describe('Card/FormCard/FormSectionTitle', () => {
  it('Card aplica superfície + borda + shadow-sm de token', () => {
    render(<Card data-testid="card">Conteúdo</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-surface');
    expect(card.className).toContain('border-border');
    expect(card.className).toContain('shadow-sm');
    expect(card).toHaveTextContent('Conteúdo');
  });

  it('Card mescla className extra via cn sem perder as classes de token', () => {
    render(
      <Card data-testid="card" className="max-w-md">
        X
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card.className).toContain('max-w-md');
    expect(card.className).toContain('bg-surface');
  });

  it('FormCard aplica rounded-lg + p-8 + shadow-sm; FormSectionTitle usa font-heading', () => {
    render(
      <FormCard data-testid="form-card">
        <FormSectionTitle>Dados pessoais</FormSectionTitle>
      </FormCard>,
    );
    const formCard = screen.getByTestId('form-card');
    expect(formCard.className).toContain('rounded-lg');
    expect(formCard.className).toContain('p-8');
    const title = screen.getByRole('heading', { name: 'Dados pessoais' });
    expect(title.className).toContain('font-heading');
  });

  it('renderiza sob data-theme="dark" sem quebrar classes de token', () => {
    document.documentElement.dataset.theme = 'dark';
    render(<Card data-testid="card">Y</Card>);
    expect(screen.getByTestId('card').className).toContain('bg-surface');
    delete document.documentElement.dataset.theme;
  });
});
