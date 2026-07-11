import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * NAV-MN-02 — USP-048 (T5, "Navegação integrada das telas públicas").
 *
 * Nenhum alvo de nav/CTA/busca/destaque da home pública pode ser um dead
 * end: `href="#"`, `href=""` ou `href='#'` (handler client de show/hide do
 * protótipo, nunca reintroduzido pelo roteamento Next.js real). Varre
 * `(public)/page.tsx` (composition root) + todos os `home-*.tsx`
 * (`_components/`) — mesmo padrão `node:fs` de `casca-*.test.ts`/
 * `home-page-static.test.ts` (USP-046/047), aplicado ao conjunto de
 * arquivos que compõem a navegação integrada.
 */

const PUBLIC_DIR = join(process.cwd(), 'src/app/(public)');
const COMPONENTS_DIR = join(PUBLIC_DIR, '_components');

const DEAD_END_HREF_PATTERN = /href=["']#["']?/;

function collectScanTargets(): string[] {
  const pagePath = join(PUBLIC_DIR, 'page.tsx');
  const homeFiles = readdirSync(COMPONENTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.startsWith('home-') && !name.endsWith('.test.tsx'))
    .map((name) => join(COMPONENTS_DIR, name));

  return [pagePath, ...homeFiles];
}

describe('NAV-MN-02 — navegação integrada sem dead ends (href="#"/vazio)', () => {
  const files = collectScanTargets();

  it('varre pelo menos page.tsx + um home-*.tsx', () => {
    expect(files.length).toBeGreaterThan(1);
  });

  it('nenhum arquivo contém href="#" / href="" / href=\'#\'', () => {
    const offenders = files
      .map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
      .filter(({ content }) => DEAD_END_HREF_PATTERN.test(content) || /href=["']["']/.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
