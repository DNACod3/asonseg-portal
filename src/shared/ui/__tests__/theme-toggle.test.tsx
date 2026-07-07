import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeToggle } from '../theme-toggle';

/**
 * Fundação de Design System da Fase 1 — T11 (DS-14/DS-15).
 */
describe('ThemeToggle', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('clique alterna data-theme de light para dark e persiste em localStorage', () => {
    document.documentElement.dataset.theme = 'light';
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('theme')).toBe('dark');
  });

  it('clique alterna data-theme de dark para light e persiste em localStorage', () => {
    document.documentElement.dataset.theme = 'dark';
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('theme')).toBe('light');
  });

  it('degrada sem lançar quando localStorage.setItem lança (SSR/navegador privado)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage indisponível');
    });
    document.documentElement.dataset.theme = 'light';
    render(<ThemeToggle />);
    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
