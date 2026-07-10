import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CASCA-MN-03 — Casca de navegação pública (USP-046, T4).
 *
 * A casca não referencia CDN/host externo (fontes/estilos/scripts) — só via
 * a fundação (`next/font`, tokens de `globals.css`). Mesma razão de
 * `ds-no-external-fonts.test.ts` (DS-MN-01), aplicada ao diretório da casca.
 */

const CASCA_DIR = join(process.cwd(), 'src/app/(public)/_components');
const SCANNED_EXTS = new Set(['.ts', '.tsx']);

const EXTERNAL_FONT_HOST_PATTERN = /fonts\.(googleapis|gstatic)\.com/i;
const EXTERNAL_HREF_SRC_PATTERN = /(?:href|src)=["']http/i;

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

describe('CASCA-MN-03 — casca pública sem CDN/host externo', () => {
  const files = collectCascaFiles(CASCA_DIR);

  it('varre pelo menos os componentes esperados da casca', () => {
    expect(files.length).toBeGreaterThan(0);
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
});
