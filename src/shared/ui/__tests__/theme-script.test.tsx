import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { THEME_INIT_SCRIPT, ThemeScript } from '../theme-script';

/**
 * Fundação de Design System da Fase 1 — T3 (DS-13). `ThemeScript` roda como
 * `<script>` inline no `<head>`, antes da hidratação. Como jsdom não executa
 * scripts injetados via `dangerouslySetInnerHTML`, o comportamento é
 * verificado executando `THEME_INIT_SCRIPT` diretamente (mesma string
 * renderizada pelo componente).
 */

function runThemeInitScript() {
  // Executa a mesma string que o script inline roda no browser.
  new Function(THEME_INIT_SCRIPT)();
}

describe('ThemeScript', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renderiza um <script> inline com o conteúdo de THEME_INIT_SCRIPT', () => {
    const { container } = render(<ThemeScript />);
    const script = container.querySelector('script');
    expect(script).not.toBeNull();
    expect(script?.innerHTML).toBe(THEME_INIT_SCRIPT);
  });

  it('seta data-theme a partir de localStorage.theme quando presente ("dark")', () => {
    window.localStorage.setItem('theme', 'dark');
    runThemeInitScript();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('seta data-theme a partir de localStorage.theme quando presente ("light")', () => {
    window.localStorage.setItem('theme', 'light');
    runThemeInitScript();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('cai em prefers-color-scheme quando não há preferência salva em localStorage', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    runThemeInitScript();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('degrada sem lançar quando localStorage.getItem lança (SSR/privado)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage indisponível');
    });

    expect(() => runThemeInitScript()).not.toThrow();
  });
});
