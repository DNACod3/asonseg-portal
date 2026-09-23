import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * USP-049 — DS-MN-01, estendida por USP-067 T19 (PNL-MN-08): guarda estática
 * anti-deriva de Design System para as superfícies novas do hub/painel
 * `/inicio`, `/perfil`, `SignOutForm`. Nenhum hex cru / paleta fixa Tailwind
 * (`bg-blue-600`, `text-red-600`…) — só tokens semânticos (`text-fg`,
 * `bg-surface`, `text-primary`, …). Mesmo padrão de
 * `src/modules/persons/__tests__/provider-ds-tokens.guard.test.ts` (USP-010 /
 * PRV-MN-01).
 *
 * USP-067 estende a varredura para TODO `inicio/_components/**` e
 * `inicio/_loaders/**` (recursivo — pega arquivo novo automaticamente,
 * mesmo molde de `app-shell-uses-tokens.test.ts`, USP-061), em vez da lista
 * fixa que só cobria `hub-link-card.tsx` (herdado da USP-049).
 */

const SCANNED_EXTS = new Set(['.ts', '.tsx']);

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (SCANNED_EXTS.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const TARGET_FILES = [
  join(process.cwd(), 'src/app/(app)/inicio/page.tsx'),
  join(process.cwd(), 'src/app/(app)/perfil/page.tsx'),
  join(process.cwd(), 'src/modules/identity/components/SignOutForm.tsx'),
  ...collectFiles(join(process.cwd(), 'src/app/(app)/inicio/_components')),
  ...collectFiles(join(process.cwd(), 'src/app/(app)/inicio/_loaders')),
];

const FIXED_PALETTE_PATTERN =
  /\b(?:bg|text|border|ring|from|to|via|accent|fill|stroke|divide|outline|shadow|placeholder)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

const RAW_HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/;

describe('DS-MN-01 (USP-049) — hub/perfil/SignOutForm só usam tokens do Design System', () => {
  it('a varredura recursiva pega os blocos e loaders novos do painel /inicio (USP-067)', () => {
    const scannedBasenames = TARGET_FILES.map((f) => f.split('/').pop());
    expect(scannedBasenames).toContain('institutional-block.tsx');
    expect(scannedBasenames).toContain('company-block.tsx');
    expect(scannedBasenames).toContain('candidate.ts');
    expect(scannedBasenames).toContain('institutional.ts');
  });

  it('nenhum dos arquivos-alvo contém utilidade Tailwind de paleta fixa', () => {
    const offenders = TARGET_FILES.map((file) => ({ file, content: readFileSync(file, 'utf-8') })).filter(
      ({ content }) => FIXED_PALETTE_PATTERN.test(content),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it('nenhum dos arquivos-alvo contém hex cru (#RRGGBB/#RGB)', () => {
    const offenders = TARGET_FILES.map((file) => ({ file, content: readFileSync(file, 'utf-8') })).filter(
      ({ content }) => RAW_HEX_PATTERN.test(content),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });
});
