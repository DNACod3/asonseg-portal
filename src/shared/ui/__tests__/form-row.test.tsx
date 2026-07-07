import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormRow } from '../form-row';

/**
 * Fundação de Design System da Fase 1 — T8 (DS-09).
 */
describe('FormRow', () => {
  it('cols=2 (default) aplica grid-cols-1 md:grid-cols-2 (colapso mobile)', () => {
    render(
      <FormRow data-testid="row">
        <div />
        <div />
      </FormRow>,
    );
    const row = screen.getByTestId('row');
    expect(row.className).toContain('grid-cols-1');
    expect(row.className).toContain('md:grid-cols-2');
  });

  it('cols=3 aplica md:grid-cols-3', () => {
    render(
      <FormRow cols={3} data-testid="row">
        <div />
        <div />
        <div />
      </FormRow>,
    );
    const row = screen.getByTestId('row');
    expect(row.className).toContain('grid-cols-1');
    expect(row.className).toContain('md:grid-cols-3');
  });
});
