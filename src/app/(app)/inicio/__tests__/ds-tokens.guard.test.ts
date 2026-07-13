import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * USP-049 — DS-MN-01: guarda estática anti-deriva de Design System para as
 * superfícies novas desta USP (hub `/inicio`, `/perfil`, `SignOutForm`).
 * Nenhum hex cru / paleta fixa Tailwind (`bg-blue-600`, `text-red-600`…) —
 * só tokens semânticos (`text-fg`, `bg-surface`, `text-primary`, …). Mesmo
 * padrão de `src/modules/persons/__tests__/provider-ds-tokens.guard.test.ts`
 * (USP-010 / PRV-MN-01).
 */

const TARGET_FILES = [
  join(process.cwd(), 'src/app/(app)/inicio/page.tsx'),
  join(process.cwd(), 'src/app/(app)/inicio/_components/hub-link-card.tsx'),
  join(process.cwd(), 'src/app/(app)/perfil/page.tsx'),
  join(process.cwd(), 'src/modules/identity/components/SignOutForm.tsx'),
];

const FIXED_PALETTE_PATTERN =
  /\b(?:bg|text|border|ring|from|to|via|accent|fill|stroke|divide|outline|shadow|placeholder)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

const RAW_HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/;

describe('DS-MN-01 (USP-049) — hub/perfil/SignOutForm só usam tokens do Design System', () => {
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
