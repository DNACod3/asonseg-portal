import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * APP-SHELL-MN-04 — Casca de navegação da área logada (USP-061, T7).
 *
 * A casca `(app)/_components/**` não altera o design system: sem hex cru,
 * sem utilitário de paleta fixa (`bg-blue-600`...), sem `system-ui`
 * hardcoded, sem host externo (CDN de fontes/estilos/scripts), sem lib de
 * ícone (lucide-react) ou de estado (Redux/MobX/Zustand/Jotai — CLAUDE.md
 * "Forbidden"). Molde: `casca-uses-tokens.test.ts` +
 * `casca-no-external-cdn.test.ts` + `casca-no-icon-state-lib.test.ts`,
 * combinados aqui num único guard MN-04, aplicado ao diretório da casca
 * `(app)`. Varre TODOS os arquivos do diretório (pega arquivos novos
 * automaticamente).
 */

const APP_SHELL_DIR = join(process.cwd(), 'src/app/(app)/_components');
const SCANNED_EXTS = new Set(['.ts', '.tsx']);

const HEX_COLOR_PATTERN = /#[0-9a-fA-F]{6}\b/;
const FIXED_PALETTE_PATTERN =
  /\b(?:bg|text|border|ring|from|via|to)-(?:blue|orange|slate|gray|grey|red|green|yellow|purple|pink|indigo|cyan|teal|amber|lime|emerald|sky|violet|fuchsia|rose|zinc|neutral|stone)-\d{2,3}\b/;
const SYSTEM_UI_PATTERN = /system-ui/;
const EXTERNAL_FONT_HOST_PATTERN = /fonts\.(googleapis|gstatic)\.com/i;
const EXTERNAL_HREF_SRC_PATTERN = /(?:href|src)=["']http/i;
const FORBIDDEN_IMPORT_PATTERN =
  /from\s+['"](lucide-react|zustand|redux|react-redux|@reduxjs\/toolkit|mobx|jotai|next-themes)['"]/;

function collectAppShellFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectAppShellFiles(fullPath));
    } else if (SCANNED_EXTS.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('APP-SHELL-MN-04 — casca (app) tokens-only (DS intacto)', () => {
  const files = collectAppShellFiles(APP_SHELL_DIR);

  it('varre pelo menos os componentes esperados da casca', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('BNAV-MN-04/DNAV-MN-04 (USP-062/063): app-bottom-nav.tsx e nav-icons.tsx constam da varredura', () => {
    const scannedBasenames = files.map((f) => f.split('/').pop());
    expect(scannedBasenames).toContain('app-bottom-nav.tsx');
    expect(scannedBasenames).toContain('nav-icons.tsx');
  });

  it('DNAV-MN-04 (USP-063): app-desktop-menu.tsx consta da varredura', () => {
    const scannedBasenames = files.map((f) => f.split('/').pop());
    expect(scannedBasenames).toContain('app-desktop-menu.tsx');
  });

  it('SIDE-MN-04 (USP-064): app-sidebar.tsx consta da varredura', () => {
    const scannedBasenames = files.map((f) => f.split('/').pop());
    expect(scannedBasenames).toContain('app-sidebar.tsx');
  });

  it('PROF-MN-02 (USP-065): profile-menu.tsx consta da varredura', () => {
    const scannedBasenames = files.map((f) => f.split('/').pop());
    expect(scannedBasenames).toContain('profile-menu.tsx');
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

  it('nenhum arquivo referencia fonts.googleapis.com/fonts.gstatic.com', () => {
    const offenders = files
      .map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
      .filter(({ content }) => EXTERNAL_FONT_HOST_PATTERN.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('nenhum arquivo referencia href="http…"/src="http…" (host externo)', () => {
    const offenders = files
      .map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
      .filter(({ content }) => EXTERNAL_HREF_SRC_PATTERN.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('nenhum arquivo importa lucide-react/Redux/MobX/Zustand/Jotai/next-themes', () => {
    const offenders = files
      .map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
      .filter(({ content }) => FORBIDDEN_IMPORT_PATTERN.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
