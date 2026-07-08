import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * USP-009 (Fase 3 unidade U1) — CAD-MN-03: guarda estática anti-deriva de
 * Design System.
 *
 * QUANDO as telas de candidato (`candidate-form.tsx` / `(app)/candidato/page.tsx`)
 * são reestilizadas ENTÃO elas NÃO DEVEM conter utilidades Tailwind de paleta
 * fixa (`bg-blue-600`, `text-red-600`, `bg-amber-*`, `text-gray-*`…) — só
 * primitivas `@/shared/ui` + tokens semânticos (`selectClass`/`errorClass`,
 * `color-mix(... var(--color-*) ...)`). Análogo a DS-MN-02 (AD-014), estendido
 * aos consumidores desta unidade. Padrão de guarda estática:
 * `src/modules/companies/__tests__/no-external-verify.test.ts`
 * (`readFileSync` + assertiva por regex).
 */

const TARGET_FILES = [
  join(process.cwd(), 'src/modules/persons/components/candidate-form.tsx'),
  join(process.cwd(), 'src/app/(app)/candidato/page.tsx'),
];

const FIXED_PALETTE_PATTERN =
  /\b(?:bg|text|border|ring|from|to|via|accent|fill|stroke|divide|outline|shadow|placeholder)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

describe('USP-009 CAD-MN-03 — telas de candidato só usam tokens do Design System', () => {
  it('nenhum dos 2 arquivos-alvo contém utilidade Tailwind de paleta fixa', () => {
    const offenders = TARGET_FILES.map((file) => ({ file, content: readFileSync(file, 'utf-8') })).filter(
      ({ content }) => FIXED_PALETTE_PATTERN.test(content),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });
});
