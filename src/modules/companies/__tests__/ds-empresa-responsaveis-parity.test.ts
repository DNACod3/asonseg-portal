import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * U13-MN-04 — guarda estática de paridade com o Design System (USP-013,
 * refactor Fase 2 / AD-014/AD-015).
 *
 * Molde: `no-external-verify.test.ts` — lê os arquivos restilizados direto do
 * disco e falha se qualquer um retiver utilitários de paleta crua ou hex.
 *
 * `responsaveis/page.tsx` é compartilhada com a USP-014: esta USP restila só o
 * shell/header + a área de `AddResponsibleForm` (T3); a seção "Responsáveis
 * ativos" (`<section>...</section>`) é dona da USP-014 (T2 de
 * usp-014-remover-responsavel) e ainda pode conter paleta crua até essa USP
 * rodar — por isso essa seção é excluída aqui (guardada à parte por
 * `ds-empresa-remover-parity.test.ts`).
 */

const ROOT = process.cwd();

const RAW_PALETTE_PATTERNS: RegExp[] = [
  /bg-blue-\d/,
  /text-gray-\d/,
  /border-gray-\d/,
  /ring-blue-\d/,
  /#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?\b/, // hex cru (#RRGGBB ou #RRGGBBAA)
];

function readSource(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf8');
}

/** Remove o bloco `<section>...</section>` (seção "Responsáveis ativos", dona da USP-014). */
function stripActiveResponsiblesSection(src: string): string {
  const start = src.indexOf('<section');
  if (start === -1) return src;
  const endTag = '</section>';
  const end = src.indexOf(endTag, start);
  if (end === -1) return src;
  return src.slice(0, start) + src.slice(end + endTag.length);
}

const FULLY_OWNED_FILES = [
  'src/modules/companies/components/add-responsible-form.tsx',
  'src/modules/companies/components/pending-responsible-links-list.tsx',
  'src/app/(app)/empresa/aceitar-vinculo/page.tsx',
];

describe('USP-013 U13-MN-04 — paridade DS das telas de responsáveis (sem paleta crua)', () => {
  it.each(FULLY_OWNED_FILES)('%s não retém utilitários de paleta crua/hex', (relPath) => {
    const src = readSource(relPath);
    const offenders = RAW_PALETTE_PATTERNS.filter((pattern) => pattern.test(src));
    expect(offenders).toEqual([]);
  });

  it('responsaveis/page.tsx (seção USP-013: shell + adição) não retém paleta crua/hex', () => {
    const src = readSource('src/app/(app)/empresa/[empresaId]/responsaveis/page.tsx');
    const ownedSlice = stripActiveResponsiblesSection(src);
    const offenders = RAW_PALETTE_PATTERNS.filter((pattern) => pattern.test(ownedSlice));
    expect(offenders).toEqual([]);
  });
});
