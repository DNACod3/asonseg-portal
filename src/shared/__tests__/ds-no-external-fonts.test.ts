import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DS-MN-01 — Fundação de Design System da Fase 1 (T3).
 *
 * Fontes só via `next/font` (auto-hospedadas no build). Esta guarda falha se
 * `globals.css`, `layout.tsx` ou qualquer outro arquivo do repo referenciar
 * um host externo de fonte (`fonts.googleapis.com`/`fonts.gstatic.com`) via
 * `<link>`/`@import`/URL crua — o `<link rel="preconnect">` do protótipo
 * (L7-9) não é portado.
 */

const REPO_ROOT = process.cwd();
const SCANNED_EXTS = new Set(['.ts', '.tsx', '.css', '.mjs', '.js']);
const IGNORED_DIRS = new Set(['node_modules', '.next', 'coverage', '__tests__']);
const EXTERNAL_FONT_HOST_PATTERN = /fonts\.(googleapis|gstatic)\.com/i;

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (SCANNED_EXTS.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('DS-MN-01 — sem host externo de fonte (fonts.googleapis.com/fonts.gstatic.com) em src/', () => {
  it('nenhum arquivo em src/ referencia fonts.googleapis.com ou fonts.gstatic.com', () => {
    const files = collectFiles(join(REPO_ROOT, 'src'));
    const offenders = files.filter((file) => EXTERNAL_FONT_HOST_PATTERN.test(readFileSync(file, 'utf-8')));
    expect(offenders).toEqual([]);
  });

  it('globals.css não contém @import/url para host de fonte externo', () => {
    const css = readFileSync(join(REPO_ROOT, 'src/app/globals.css'), 'utf-8');
    expect(css).not.toMatch(/@import/i);
    expect(css).not.toMatch(EXTERNAL_FONT_HOST_PATTERN);
  });

  it('layout.tsx carrega fontes via next/font/google (auto-hospedado), não via <link>', () => {
    const layout = readFileSync(join(REPO_ROOT, 'src/app/layout.tsx'), 'utf-8');
    expect(layout).toMatch(/from ['"]next\/font\/google['"]/);
    expect(layout).not.toMatch(/<link[^>]*fonts\.(googleapis|gstatic)\.com/i);
    expect(layout).not.toMatch(EXTERNAL_FONT_HOST_PATTERN);
  });
});
