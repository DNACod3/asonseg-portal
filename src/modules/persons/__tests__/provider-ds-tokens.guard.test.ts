import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * USP-010 (Fase 4 unidade U1) — PRV-MN-01: guarda estática anti-deriva de
 * Design System.
 *
 * QUANDO as telas de prestador (`provider-form.tsx` / `(app)/prestador/page.tsx`)
 * são reestilizadas ENTÃO elas NÃO DEVEM conter utilidades Tailwind de paleta
 * fixa (`bg-blue-600`, `text-red-600`, `bg-emerald-*`, `text-gray-*`…) — só
 * primitivas `@/shared/ui` + tokens semânticos (`selectClass`/`errorClass`,
 * `color-mix(... var(--color-*) ...)`). Análogo a DS-MN-02 (AD-014) e ao gêmeo
 * CAD-MN-03 (USP-009, `candidate-ds-tokens.guard.test.ts`). Padrão de guarda
 * estática: `src/modules/companies/__tests__/no-external-verify.test.ts`
 * (`readFileSync` + assertiva por regex).
 */

const TARGET_FILES = [
  join(process.cwd(), 'src/modules/persons/components/provider-form.tsx'),
  join(process.cwd(), 'src/app/(app)/prestador/page.tsx'),
];

const FIXED_PALETTE_PATTERN =
  /\b(?:bg|text|border|ring|from|to|via|accent|fill|stroke|divide|outline|shadow|placeholder)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

describe('USP-010 PRV-MN-01 — telas de prestador só usam tokens do Design System', () => {
  it('nenhum dos 2 arquivos-alvo contém utilidade Tailwind de paleta fixa', () => {
    const offenders = TARGET_FILES.map((file) => ({ file, content: readFileSync(file, 'utf-8') })).filter(
      ({ content }) => FIXED_PALETTE_PATTERN.test(content),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });
});
