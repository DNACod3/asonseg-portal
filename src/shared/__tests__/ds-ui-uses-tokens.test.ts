import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DS-MN-02 / DS-12 — Fundação de Design System da Fase 1 (T12).
 *
 * Nenhum primitivo em `src/shared/ui/**` pode conter hex cru (`#RRGGBB`) nem
 * utilitário de paleta fixa (`bg-blue-600`, `text-orange-500`,
 * `border-slate-*`, `text-gray-*`…) para superfícies temáticas, nem
 * `system-ui` hardcoded — só classes mapeadas por token. Varre todos os
 * `.tsx`/`.ts` de `src/shared/ui/` (fora de `__tests__/`).
 */

const UI_DIR = join(process.cwd(), 'src/shared/ui');
const SCANNED_EXTS = new Set(['.ts', '.tsx']);

const HEX_COLOR_PATTERN = /#[0-9a-fA-F]{6}\b/;
const FIXED_PALETTE_PATTERN =
  /\b(?:bg|text|border|ring|from|via|to)-(?:blue|orange|slate|gray|grey|red|green|yellow|purple|pink|indigo|cyan|teal|amber|lime|emerald|sky|violet|fuchsia|rose|zinc|neutral|stone)-\d{2,3}\b/;
const SYSTEM_UI_PATTERN = /system-ui/;

function collectUiSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === '__tests__') continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectUiSourceFiles(fullPath));
    } else if (SCANNED_EXTS.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('DS-MN-02/DS-12 — primitivos de src/shared/ui/** só usam classes de token', () => {
  const files = collectUiSourceFiles(UI_DIR);

  it('varre pelo menos os primitivos esperados (nenhum arquivo ausente por engano)', () => {
    expect(files.length).toBeGreaterThanOrEqual(14);
  });

  it('nenhum arquivo contém hex cru (#RRGGBB)', () => {
    const offenders = files
      .map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
      .filter(({ content }) => HEX_COLOR_PATTERN.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('nenhum arquivo contém utilitário de paleta fixa (bg-blue-600, text-gray-500, border-slate-*…)', () => {
    const offenders = files
      .map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
      .filter(({ content }) => FIXED_PALETTE_PATTERN.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('nenhum arquivo referencia system-ui hardcoded', () => {
    const offenders = files
      .map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
      .filter(({ content }) => SYSTEM_UI_PATTERN.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
