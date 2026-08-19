import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * USP-067 — T19 / PNL-MN-05: `(app)/inicio/page.tsx` e os loaders
 * (`_loaders/**`) SHALL NOT consultar Prisma diretamente — toda leitura vive
 * em `queries/` do módulo dono (cross-role via View Model). Varre
 * recursivamente `page.tsx` + `_loaders/**` (pega arquivo novo
 * automaticamente, mesmo molde de `app-shell-uses-tokens.test.ts` — USP-061).
 */

const INICIO_DIR = join(process.cwd(), 'src/app/(app)/inicio');
const SCANNED_EXTS = new Set(['.ts', '.tsx']);

const DIRECT_PRISMA_IMPORT_PATTERN = /from\s+['"]@\/shared\/lib\/prisma['"]/;
const DIRECT_PRISMA_CALL_PATTERN = /\bprisma\s*\./;

function collectFiles(dir: string, filter: (path: string) => boolean): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, filter));
    } else if (SCANNED_EXTS.has(extname(entry.name)) && filter(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

const TARGET_FILES = [
  join(INICIO_DIR, 'page.tsx'),
  ...collectFiles(join(INICIO_DIR, '_loaders'), () => true),
];

describe('PNL-MN-05 — page.tsx e _loaders/** não acessam Prisma diretamente', () => {
  it('varre pelo menos page.tsx + os 5 loaders por papel', () => {
    expect(TARGET_FILES.length).toBeGreaterThanOrEqual(6);
  });

  it('nenhum arquivo-alvo importa `@/shared/lib/prisma`', () => {
    const offenders = TARGET_FILES.map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
      .filter(({ content }) => DIRECT_PRISMA_IMPORT_PATTERN.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('nenhum arquivo-alvo chama `prisma.<model>` diretamente', () => {
    const offenders = TARGET_FILES.map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
      .filter(({ content }) => DIRECT_PRISMA_CALL_PATTERN.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
