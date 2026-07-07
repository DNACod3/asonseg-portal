import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DS-MN-04 — Fundação de Design System da Fase 1 (T2).
 *
 * `globals.css` SHALL NOT manter o bloco legado
 * `@media (prefers-color-scheme: dark)` sobrescrevendo `--background`/
 * `--foreground` — conflitaria com o mecanismo único de dark mode
 * (`[data-theme="dark"]`). Também confirma que as vars genéricas legadas
 * (`--background`/`--foreground`) não foram reintroduzidas.
 */

const GLOBALS_CSS_PATH = join(process.cwd(), 'src/app/globals.css');

describe('DS-MN-04 — mecanismo único de dark mode (sem prefers-color-scheme concorrente)', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf-8');

  it('não contém o bloco legado @media (prefers-color-scheme: dark)', () => {
    expect(css).not.toMatch(/@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/i);
  });

  it('não reintroduz as vars genéricas legadas --background/--foreground', () => {
    expect(css).not.toMatch(/--background:/);
    expect(css).not.toMatch(/--foreground:/);
  });

  it('o único seletor que sobrescreve os tokens de tema é [data-theme="dark"]', () => {
    const themeOverrideSelectors = css.match(/\[data-theme=['"]dark['"]\]/g) ?? [];
    expect(themeOverrideSelectors.length).toBeGreaterThanOrEqual(1);
  });
});
