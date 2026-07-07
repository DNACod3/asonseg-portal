import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LgpdBox } from '../lgpd-box';

/**
 * Fundação de Design System da Fase 1 — T9 (DS-11 parcial).
 */
describe('LgpdBox', () => {
  it('renderiza title e children', () => {
    render(
      <LgpdBox title="Consentimento LGPD">
        <p>Seus dados serão usados conforme a política.</p>
      </LgpdBox>,
    );
    expect(screen.getByRole('heading', { name: 'Consentimento LGPD' })).toBeInTheDocument();
    expect(screen.getByText('Seus dados serão usados conforme a política.')).toBeInTheDocument();
  });

  it('aplica bg-background + border-border (token)', () => {
    render(
      <LgpdBox title="X" data-testid="box">
        Y
      </LgpdBox>,
    );
    const box = screen.getByTestId('box');
    expect(box.className).toContain('bg-background');
    expect(box.className).toContain('border-border');
  });
});
