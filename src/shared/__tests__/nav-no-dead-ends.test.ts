import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * NAV-MN-02 — USP-048 (T5, "Navegação integrada das telas públicas").
 *
 * Nenhum alvo de nav/CTA/busca/destaque da home pública pode ser um dead
 * end: `href="#"`, `href=""` ou `href='#'` (handler client de show/hide do
 * protótipo, nunca reintroduzido pelo roteamento Next.js real). Varre
 * `(public)/page.tsx` (composition root) + **todos** os `.tsx` não-teste de
 * `_components/` — os `home-*.tsx` (conteúdo da home) **e a casca de
 * navegação** (`site-header.tsx`, `site-footer.tsx`, `public-nav.tsx`), que é
 * justamente onde os `href="#"` do protótipo estático viviam antes da
 * migração para o roteamento Next.js real (USP-046). Restringir o escopo só
 * a `home-*` deixaria a casca fora do alcance do must-not NAV-MN-02, que é
 * mais amplo (nav/CTA/busca/destaque) do que apenas a home. Mesmo padrão
 * `node:fs` de `casca-*.test.ts`/`home-page-static.test.ts` (USP-046/047).
 */

const PUBLIC_DIR = join(process.cwd(), 'src/app/(public)');
const COMPONENTS_DIR = join(PUBLIC_DIR, '_components');

const DEAD_END_HREF_PATTERN = /href=["']#["']?/;

function collectScanTargets(): string[] {
  const pagePath = join(PUBLIC_DIR, 'page.tsx');
  const componentFiles = readdirSync(COMPONENTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx'))
    .map((name) => join(COMPONENTS_DIR, name));

  return [pagePath, ...componentFiles];
}

describe('NAV-MN-02 — navegação integrada sem dead ends (href="#"/vazio)', () => {
  const files = collectScanTargets();

  it('varre page.tsx + a casca (site-header/site-footer/public-nav) + os home-*.tsx (≥8 arquivos)', () => {
    // Piso alto o bastante para pegar um bug de scan-zero-arquivos, mas
    // ancorado no conjunto real (page.tsx + 3 de casca + ≥5 home-*.tsx) em
    // vez de um número solto — se um arquivo for removido/renomeado, este
    // teste também acusa.
    expect(files.length).toBeGreaterThanOrEqual(9);
    expect(files).toContain(join(PUBLIC_DIR, 'page.tsx'));
    expect(files.some((f) => f.endsWith('site-header.tsx'))).toBe(true);
    expect(files.some((f) => f.endsWith('site-footer.tsx'))).toBe(true);
    expect(files.some((f) => f.endsWith('public-nav.tsx'))).toBe(true);
    expect(files.filter((f) => f.includes('home-')).length).toBeGreaterThanOrEqual(5);
  });

  it('nenhum arquivo contém href="#" / href="" / href=\'#\'', () => {
    const offenders = files
      .map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
      .filter(({ content }) => DEAD_END_HREF_PATTERN.test(content) || /href=["']["']/.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
