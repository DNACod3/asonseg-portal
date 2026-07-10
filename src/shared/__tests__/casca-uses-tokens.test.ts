import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CASCA-MN-02 — Casca de navegação pública (USP-046, T4).
 *
 * Nenhum arquivo da casca (`(public)/_components/**`) pode conter hex cru
 * (`#RRGGBB`) nem utilitário de paleta fixa (`bg-blue-600`, `text-gray-500`,
 * `border-slate-*`…) para superfícies temáticas, nem `system-ui` hardcoded —
 * só classes mapeadas por token. Mesmo padrão/razão de
 * `ds-ui-uses-tokens.test.ts` (DS-MN-02), aplicado ao diretório da casca.
 */

const CASCA_DIR = join(process.cwd(), 'src/app/(public)/_components');
const SCANNED_EXTS = new Set(['.ts', '.tsx']);

const HEX_COLOR_PATTERN = /#[0-9a-fA-F]{6}\b/;
const FIXED_PALETTE_PATTERN =
  /\b(?:bg|text|border|ring|from|via|to)-(?:blue|orange|slate|gray|grey|red|green|yellow|purple|pink|indigo|cyan|teal|amber|lime|emerald|sky|violet|fuchsia|rose|zinc|neutral|stone)-\d{2,3}\b/;
const SYSTEM_UI_PATTERN = /system-ui/;

function collectCascaFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectCascaFiles(fullPath));
    } else if (SCANNED_EXTS.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('CASCA-MN-02 — casca pública só usa classes de token', () => {
  const files = collectCascaFiles(CASCA_DIR);

  it('varre pelo menos os componentes esperados da casca', () => {
    expect(files.length).toBeGreaterThan(0);
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
