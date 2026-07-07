import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * U14-MN-04 — guarda estática de paridade com o Design System (USP-014,
 * refactor Fase 2 / AD-014/AD-015).
 *
 * Molde: `no-external-verify.test.ts` — lê os arquivos restilizados direto do
 * disco e falha se qualquer um retiver utilitários de paleta crua ou hex.
 *
 * `responsaveis/page.tsx` é compartilhada com a USP-013: esta USP restila só
 * a seção "Responsáveis ativos" (`<section>...</section>`); o shell/header +
 * área de adição são cobertos por `ds-empresa-responsaveis-parity.test.ts`
 * (USP-013). Por isso, aqui verificamos só o bloco `<section>`.
 */

const ROOT = process.cwd();

const RAW_PALETTE_PATTERNS: RegExp[] = [
  /bg-red-\d/,
  /text-gray-\d/,
  /border-gray-\d/,
  /divide-gray-\d/,
  /#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?\b/, // hex cru (#RRGGBB ou #RRGGBBAA)
];

function readSource(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf8');
}

/** Extrai o bloco `<section>...</section>` (seção "Responsáveis ativos", dona da USP-014). */
function extractActiveResponsiblesSection(src: string): string {
  const start = src.indexOf('<section');
  const endTag = '</section>';
  const end = src.indexOf(endTag, start);
  if (start === -1 || end === -1) {
    throw new Error('Seção <section> (Responsáveis ativos) não encontrada em responsaveis/page.tsx.');
  }
  return src.slice(start, end + endTag.length);
}

describe('USP-014 U14-MN-04 — paridade DS da remoção de responsável (sem paleta crua)', () => {
  it('remove-responsible-dialog.tsx não retém utilitários de paleta crua/hex', () => {
    const src = readSource('src/modules/companies/components/remove-responsible-dialog.tsx');
    const offenders = RAW_PALETTE_PATTERNS.filter((pattern) => pattern.test(src));
    expect(offenders).toEqual([]);
  });

  it('responsaveis/page.tsx (seção "Responsáveis ativos") não retém paleta crua/hex', () => {
    const src = readSource('src/app/(app)/empresa/[empresaId]/responsaveis/page.tsx');
    const section = extractActiveResponsiblesSection(src);
    const offenders = RAW_PALETTE_PATTERNS.filter((pattern) => pattern.test(section));
    expect(offenders).toEqual([]);
  });
});
