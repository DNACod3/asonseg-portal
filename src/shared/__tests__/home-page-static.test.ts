import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * HOME-MN-01/HOME-MN-02 — USP-047 (T9).
 *
 * A home pública (`(public)/page.tsx`) é landing estática/pública pura: sem
 * sessão/PII/Prisma/View Model/Server Action (HOME-MN-01), e só classes de
 * token — sem hex cru/paleta fixa/`system-ui`/CDN externo (HOME-MN-02).
 * Mesmo padrão `node:fs` de `casca-*.test.ts` (USP-046)/`closed-src-root.
 * test.ts`, aplicado ao arquivo da página (não a um diretório).
 *
 * As guardas `casca-uses-tokens`/`casca-no-external-cdn`/`casca-no-auth-pii`/
 * `casca-no-icon-state-lib` já varrem `(public)/_components/**` inteiro —
 * cobrem automaticamente os `home-*.tsx` desta USP. A segunda `it` abaixo
 * confirma essa cobertura efetiva (sanidade, HOME-MN-01/02 owning task).
 */

const HOME_PAGE_PATH = join(process.cwd(), 'src/app/(public)/page.tsx');
const CASCA_DIR = join(process.cwd(), 'src/app/(public)/_components');
const SCANNED_EXTS = new Set(['.ts', '.tsx']);

const FORBIDDEN_IMPORT_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'getCurrentPerson', pattern: /\bgetCurrentPerson\b/ },
  { name: 'requireActivePerson', pattern: /\brequireActivePerson\b/ },
  { name: 'View Models (@/modules/*/views)', pattern: /@\/modules\/[^'"]*\/views/ },
  { name: 'Prisma (@/shared/lib/prisma)', pattern: /@\/shared\/lib\/prisma/ },
  { name: 'Server Actions (@/modules/*/actions)', pattern: /@\/modules\/[^'"]*\/actions/ },
  { name: "'use server'", pattern: /['"]use server['"]/ },
];

const HEX_COLOR_PATTERN = /#[0-9a-fA-F]{6}\b/;
const FIXED_PALETTE_PATTERN =
  /\b(?:bg|text|border|ring|from|via|to)-(?:blue|orange|slate|gray|grey|red|green|yellow|purple|pink|indigo|cyan|teal|amber|lime|emerald|sky|violet|fuchsia|rose|zinc|neutral|stone)-\d{2,3}\b/;
const SYSTEM_UI_PATTERN = /system-ui/;
const EXTERNAL_HREF_SRC_PATTERN = /(?:href|src)=["']http/i;
const EXTERNAL_FONT_HOST_PATTERN = /fonts\.(googleapis|gstatic)\.com/i;

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

describe('HOME-MN-01 — home pública sem sessão/PII/Prisma/View Model/Server Action', () => {
  const pageContent = readFileSync(HOME_PAGE_PATH, 'utf-8');

  it.each(FORBIDDEN_IMPORT_PATTERNS)('page.tsx não referencia $name', ({ pattern }) => {
    expect(pattern.test(pageContent)).toBe(false);
  });
});

describe('HOME-MN-02 — home pública só com classes de token, sem CDN externo', () => {
  const pageContent = readFileSync(HOME_PAGE_PATH, 'utf-8');

  it('page.tsx não contém hex cru (#RRGGBB)', () => {
    expect(HEX_COLOR_PATTERN.test(pageContent)).toBe(false);
  });

  it('page.tsx não contém utilitário de paleta fixa', () => {
    expect(FIXED_PALETTE_PATTERN.test(pageContent)).toBe(false);
  });

  it('page.tsx não referencia system-ui hardcoded', () => {
    expect(SYSTEM_UI_PATTERN.test(pageContent)).toBe(false);
  });

  it('page.tsx não referencia href="http…"/src="http…" (host externo)', () => {
    expect(EXTERNAL_HREF_SRC_PATTERN.test(pageContent)).toBe(false);
  });

  it('page.tsx não referencia fonts.googleapis.com/fonts.gstatic.com', () => {
    expect(EXTERNAL_FONT_HOST_PATTERN.test(pageContent)).toBe(false);
  });
});

describe('HOME-MN-01/02 — sanidade: os home-*.tsx estão sob a cobertura das guardas casca-*', () => {
  it('a varredura de (public)/_components/** inclui pelo menos um home-*.tsx', () => {
    const files = collectCascaFiles(CASCA_DIR).map((file) => file.split('/').pop() ?? '');
    const homeFiles = files.filter((name) => name.startsWith('home-') && !name.endsWith('.test.tsx'));
    expect(homeFiles.length).toBeGreaterThan(0);
  });
});
