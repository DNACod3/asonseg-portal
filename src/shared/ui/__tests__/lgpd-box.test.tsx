import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LgpdBox, LgpdCheck } from '../lgpd-box';

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

describe('LgpdCheck', () => {
  it('associa o checkbox ao label (span) via htmlFor gerado', () => {
    render(<LgpdCheck>Aceito os termos</LgpdCheck>);
    const checkbox = screen.getByRole('checkbox', { name: 'Aceito os termos' });
    expect(checkbox).toBeInTheDocument();
  });

  it('encaminha ref e props nativos (onChange, checked) ao input', () => {
    const ref = createRef<HTMLInputElement>();
    const onChange = vi.fn();
    render(
      <LgpdCheck ref={ref} onChange={onChange}>
        Aceito
      </LgpdCheck>,
    );
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Aceito' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('renderiza sob data-theme="dark" sem quebrar', () => {
    document.documentElement.dataset.theme = 'dark';
    render(<LgpdCheck>Aceito</LgpdCheck>);
    expect(screen.getByRole('checkbox', { name: 'Aceito' })).toBeInTheDocument();
    delete document.documentElement.dataset.theme;
  });
});
