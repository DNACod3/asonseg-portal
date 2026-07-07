import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../button';

/**
 * Fundação de Design System da Fase 1 — T4 (DS-06).
 */
describe('Button', () => {
  it('variant=primary aplica bg-cta e hover:bg-cta-hover (CTA laranja)', () => {
    render(<Button variant="primary">Entrar</Button>);
    const btn = screen.getByRole('button', { name: 'Entrar' });
    expect(btn.className.split(/\s+/)).toContain('bg-cta');
    expect(btn.className).toContain('hover:bg-cta-hover');
  });

  it('variant=secondary aplica border-primary e text-primary', () => {
    render(<Button variant="secondary">Cancelar</Button>);
    const btn = screen.getByRole('button', { name: 'Cancelar' });
    expect(btn.className).toContain('border-primary');
    expect(btn.className).toContain('text-primary');
  });

  it('variant=outline aplica border-border (borda neutra)', () => {
    render(<Button variant="outline">Voltar</Button>);
    const btn = screen.getByRole('button', { name: 'Voltar' });
    expect(btn.className).toContain('border-border');
  });

  it('variant=danger aplica bg-danger e text-white (ação destrutiva, USP-007)', () => {
    render(<Button variant="danger">Inativar Pessoa</Button>);
    const btn = screen.getByRole('button', { name: 'Inativar Pessoa' });
    expect(btn.className.split(/\s+/)).toContain('bg-danger');
    expect(btn.className).toContain('text-white');
  });

  it('size sm/default/lg aplicam paddings distintos (.btn-sm/.btn-lg do protótipo)', () => {
    const { rerender } = render(<Button size="sm">A</Button>);
    expect(screen.getByRole('button', { name: 'A' }).className).toContain('px-4');
    rerender(<Button size="default">A</Button>);
    expect(screen.getByRole('button', { name: 'A' }).className).toContain('px-6');
    rerender(<Button size="lg">A</Button>);
    expect(screen.getByRole('button', { name: 'A' }).className).toContain('px-8');
  });

  it('asChild renderiza o filho (<a>) via Slot, sem <button> extra', () => {
    render(
      <Button asChild variant="primary">
        <a href="https://example.com/vagas">Ver vagas</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Ver vagas' });
    expect(link.tagName).toBe('A');
    expect(link.className).toContain('bg-cta');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('encaminha ref para o elemento <button> nativo', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Enviar</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('renderiza sob data-theme="dark" sem quebrar classes de token', () => {
    document.documentElement.dataset.theme = 'dark';
    render(<Button variant="primary">Entrar</Button>);
    const btn = screen.getByRole('button', { name: 'Entrar' });
    expect(btn.className.split(/\s+/)).toContain('bg-cta');
    delete document.documentElement.dataset.theme;
  });
});
