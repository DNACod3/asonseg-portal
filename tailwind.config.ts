import type { Config } from 'tailwindcss';

/**
 * Fundação de Design System da Fase 1 (DS-03/DS-04). Mapeia as variáveis CSS
 * de `src/app/globals.css` (`:root` + `[data-theme="dark"]`) para chaves
 * semânticas do Tailwind. `darkMode: ['selector', ...]` casa com o mesmo
 * seletor de atributo usado pelos tokens — ver design.md §Token System.
 */
const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/modules/**/*.{ts,tsx}',
    './src/shared/**/*.{ts,tsx}',
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        cta: { DEFAULT: 'var(--color-cta)', hover: 'var(--color-cta-hover)' },
        background: 'var(--color-background)',
        surface: 'var(--color-white)',
        fg: { DEFAULT: 'var(--color-text)', muted: 'var(--color-text-light)' },
        border: 'var(--color-border)',
        success: 'var(--color-success)',
        danger: 'var(--color-danger)',
        // USP-046 (CASCA-08/design.md §4): superfície fixa do footer (não
        // inverte como `fg`) — mesma razão do token dedicado em globals.css.
        footer: 'var(--color-footer)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['var(--font-nunito)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
