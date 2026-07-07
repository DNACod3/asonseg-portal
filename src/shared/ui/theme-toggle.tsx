'use client';

import { useEffect, useState } from 'react';
import { cn } from './cn';

/**
 * Fundação de Design System da Fase 1 (T11, DS-14/DS-15). Mapeia
 * `.theme-toggle` do protótipo (L118-132). Alterna
 * `document.documentElement.dataset.theme` e persiste em `localStorage` — só
 * React nativo (`useState`/`useEffect`), sem lib de estado (DS-MN-05). Ícone
 * lua/sol via SVG inline (sem `lucide-react`). Degrada sem lançar quando
 * `localStorage` está indisponível (SSR/navegador privado — edge case).
 */
function readInitialTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setTheme(readInitialTheme());
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem('theme', next);
    } catch {
      // localStorage indisponível (SSR/navegador privado) — degrada sem lançar.
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-border bg-surface text-fg transition-colors hover:border-primary',
        className,
      )}
    >
      {theme === 'dark' ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="h-[18px] w-[18px]"
        >
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
