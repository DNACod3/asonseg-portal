import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DS-01/DS-02/DS-03/DS-04 — Fundação de Design System da Fase 1 (T2).
 *
 * Confirma que `globals.css` reproduz, valor por valor, os tokens do
 * protótipo (`docs/prototipo/index.html` L12-58) em `:root` (light) e
 * `[data-theme="dark"]` (dark override), e que `tailwind.config.ts` mapeia as
 * chaves semânticas + `darkMode` selector correspondentes.
 */

const GLOBALS_CSS_PATH = join(process.cwd(), 'src/app/globals.css');
const TAILWIND_CONFIG_PATH = join(process.cwd(), 'tailwind.config.ts');

function readGlobalsCss(): string {
  return readFileSync(GLOBALS_CSS_PATH, 'utf-8');
}

function readTailwindConfig(): string {
  return readFileSync(TAILWIND_CONFIG_PATH, 'utf-8');
}

/** Extrai o bloco de um seletor simples (sem chaves aninhadas) do CSS. */
function extractBlock(css: string, selectorPattern: RegExp): string {
  const match = selectorPattern.exec(css);
  if (!match) return '';
  const start = match.index + match[0].length;
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

describe('DS-01/DS-02 — tokens em globals.css idênticos ao protótipo (light + dark)', () => {
  const css = readGlobalsCss();
  const rootBlock = extractBlock(css, /:root\s*\{/);
  const darkBlock = extractBlock(css, /\[data-theme=['"]dark['"]\]\s*\{/);

  const lightPairs: Array<[string, string]> = [
    ['--color-primary', '#2563eb'],
    ['--color-secondary', '#3b82f6'],
    ['--color-cta', '#f97316'],
    ['--color-cta-hover', '#ea580c'],
    ['--color-background', '#f8fafc'],
    ['--color-text', '#1e293b'],
    ['--color-text-light', '#64748b'],
    ['--color-border', '#e2e8f0'],
    ['--color-white', '#ffffff'],
    ['--color-success', '#10b981'],
    ['--color-danger', '#ef4444'],
  ];

  it.each(lightPairs)('light: %s === %s', (token, expected) => {
    const re = new RegExp(`${token}:\\s*${expected}`, 'i');
    expect(rootBlock).toMatch(re);
  });

  it('light: escala de espaçamento 4/8/16/24/32/48/64px', () => {
    expect(rootBlock).toMatch(/--space-xs:\s*4px/);
    expect(rootBlock).toMatch(/--space-sm:\s*8px/);
    expect(rootBlock).toMatch(/--space-md:\s*16px/);
    expect(rootBlock).toMatch(/--space-lg:\s*24px/);
    expect(rootBlock).toMatch(/--space-xl:\s*32px/);
    expect(rootBlock).toMatch(/--space-2xl:\s*48px/);
    expect(rootBlock).toMatch(/--space-3xl:\s*64px/);
  });

  it('light: escala de raio 8/12/16/24px', () => {
    expect(rootBlock).toMatch(/--radius-sm:\s*8px/);
    expect(rootBlock).toMatch(/--radius-md:\s*12px/);
    expect(rootBlock).toMatch(/--radius-lg:\s*16px/);
    expect(rootBlock).toMatch(/--radius-xl:\s*24px/);
  });

  it('light: escala de sombra declarada (sm/md/lg/xl)', () => {
    expect(rootBlock).toMatch(/--shadow-sm:/);
    expect(rootBlock).toMatch(/--shadow-md:/);
    expect(rootBlock).toMatch(/--shadow-lg:/);
    expect(rootBlock).toMatch(/--shadow-xl:/);
  });

  const darkPairs: Array<[string, string]> = [
    ['--color-primary', '#3b82f6'],
    ['--color-cta', '#fb923c'],
    ['--color-background', '#0f172a'],
    ['--color-text', '#f1f5f9'],
    ['--color-border', '#334155'],
    ['--color-white', '#1e293b'],
  ];

  it.each(darkPairs)('dark: %s === %s', (token, expected) => {
    const re = new RegExp(`${token}:\\s*${expected}`, 'i');
    expect(darkBlock).toMatch(re);
  });

  it('dark: sombras redefinidas com opacidade maior (não reaproveita o valor light)', () => {
    expect(darkBlock).toMatch(/--shadow-sm:\s*0 1px 2px rgba\(0,\s*0,\s*0,\s*0\.3\)/);
  });
});

describe('DS-03/DS-04 — tailwind.config.ts mapeia tokens + darkMode selector', () => {
  const config = readTailwindConfig();

  it('darkMode usa a estratégia selector com o mesmo atributo dos tokens', () => {
    expect(config).toMatch(/darkMode:\s*\[\s*['"]selector['"]\s*,\s*['"]\[data-theme=(\\?["'])dark\1\]['"]\s*\]/);
  });

  it('mapeia as chaves semânticas de cor (primary/cta/background/surface/fg/border/success/danger)', () => {
    for (const key of [
      'primary',
      'secondary',
      'cta',
      'background',
      'surface',
      'fg',
      'border',
      'success',
      'danger',
    ]) {
      expect(config, `esperava a chave de cor "${key}"`).toContain(key);
    }
    expect(config).toContain('var(--color-primary)');
    expect(config).toContain('var(--color-cta)');
    expect(config).toContain('var(--color-white)');
  });

  it('mapeia borderRadius/boxShadow/fontFamily para as variáveis correspondentes', () => {
    expect(config).toMatch(/borderRadius:\s*\{[^}]*var\(--radius-sm\)/s);
    expect(config).toMatch(/boxShadow:\s*\{[^}]*var\(--shadow-sm\)/s);
    expect(config).toMatch(/fontFamily:\s*\{[^}]*var\(--font-dm-sans\)/s);
    expect(config).toMatch(/fontFamily:\s*\{[^}]*var\(--font-nunito\)/s);
  });
});
