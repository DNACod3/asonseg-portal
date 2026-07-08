import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * U22-MN-05 — guarda estática de paridade DS do detalhe de vaga (USP-022 / T3).
 * Molde: `src/modules/companies/__tests__/no-external-verify.test.ts` (varredura
 * `node:fs` + regex sobre fontes).
 *
 * Trava "DS construído mas não adotado" nos 2 arquivos restilizados por esta USP
 * (`job-detail.tsx`/T1, `page.tsx`/T2): falha se qualquer um reter paleta crua
 * (`bg-blue-600`, `text-gray-*`, `bg-gray-*`, `border-gray-*`) ou hex literal em
 * `className`. A varredura é restrita ao conteúdo de `className="..."`/`className={...}`
 * — não ao arquivo inteiro — para não confundir referências de issue no JSDoc (ex.:
 * `USP-022 / #277`) com hex curto (mesmo cuidado de `ds-vagas-parity.test.ts`).
 */

const FILES = [
  join(process.cwd(), 'src/modules/jobs/components/job-detail.tsx'),
  join(process.cwd(), 'src/app/(public)/vagas/[id]/page.tsx'),
];

const RAW_PALETTE_PATTERN = /\b(?:bg-blue-600|text-gray-\d{2,3}|bg-gray-\d{2,3}|border-gray-\d{2,3})\b/;
const HEX_COLOR_PATTERN = /#[0-9a-fA-F]{6}\b/;

/** Extrai o conteúdo de todo `className="..."` (aspas simples/duplas) do arquivo. */
function extractClassNames(source: string): string[] {
  const matches = source.matchAll(/className=(?:"([^"]*)"|'([^']*)')/g);
  return Array.from(matches, (m) => m[1] ?? m[2] ?? '');
}

describe('U22-MN-05 — job-detail sem paleta crua (bg-blue-600/text-gray-*/bg-gray-*/border-gray-*) nem hex', () => {
  it.each(FILES)('%s: nenhum className com paleta crua', (file) => {
    const classNames = extractClassNames(readFileSync(file, 'utf-8'));
    const offenders = classNames.filter((c) => RAW_PALETTE_PATTERN.test(c));
    expect(offenders).toEqual([]);
  });

  it.each(FILES)('%s: nenhum className com hex literal (#RRGGBB)', (file) => {
    const classNames = extractClassNames(readFileSync(file, 'utf-8'));
    const offenders = classNames.filter((c) => HEX_COLOR_PATTERN.test(c));
    expect(offenders).toEqual([]);
  });
});
