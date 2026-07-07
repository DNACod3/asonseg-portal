import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from '../input';
import { Label } from '../label';
import { Textarea } from '../textarea';

/**
 * Fundação de Design System da Fase 1 — T5 (DS-07).
 */
describe('Input/Label/Textarea', () => {
  it('Input encaminha ref para o <input> nativo', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="Email" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('Input aplica borda de token e anel de foco primary', () => {
    render(<Input aria-label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input.className).toContain('border-border');
    expect(input.className).toContain('focus:ring-primary');
  });

  it('Textarea encaminha ref e props nativos (compatível com react-hook-form register)', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} aria-label="Mensagem" placeholder="Escreva" />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    expect(screen.getByPlaceholderText('Escreva')).toBeInTheDocument();
  });

  it('Label associa via htmlFor ao Input correspondente', () => {
    render(
      <>
        <Label htmlFor="email-field">E-mail</Label>
        <Input id="email-field" />
      </>,
    );
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
  });

  it('renderiza sob data-theme="dark" sem quebrar classes de token', () => {
    document.documentElement.dataset.theme = 'dark';
    render(<Input aria-label="Senha" />);
    expect(screen.getByLabelText('Senha').className).toContain('border-border');
    delete document.documentElement.dataset.theme;
  });
});
