import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * U12-MN-04 — guarda estática de paridade com o Design System (USP-012,
 * refactor Fase 2 / AD-014-AD-015).
 *
 * O cadastro de Empresa foi reestilizado com os primitivos/tokens do DS
 * (`Input`/`Label`/`Textarea`/`Button`/`LgpdBox` de `@/shared/ui`). Esta
 * guarda lê os arquivos restilizados direto do disco (molde:
 * `no-external-verify.test.ts`) e falha se qualquer um deles retiver
 * utilitários de paleta crua ou hex — sinal de que o DS não substituiu de
 * fato o Tailwind ad-hoc anterior ("fundação construída mas não provada").
 */

const ROOT = process.cwd();

const RESTYLED_FILES = [
  'src/modules/companies/components/create-company-form.tsx',
  'src/app/(app)/empresa/cadastrar/page.tsx',
];

const RAW_PALETTE_PATTERNS: RegExp[] = [
  /bg-blue-\d/,
  /text-gray-\d/,
  /border-gray-\d/,
  /ring-blue-\d/,
  /focus:ring-blue-\d/,
  /#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?\b/, // hex cru (#RRGGBB ou #RRGGBBAA)
];

describe('USP-012 U12-MN-04 — paridade DS do cadastro de Empresa (sem paleta crua)', () => {
  it.each(RESTYLED_FILES)('%s não retém utilitários de paleta crua/hex', (relPath) => {
    const fullPath = join(ROOT, relPath);
    const src = readFileSync(fullPath, 'utf8');

    const offenders = RAW_PALETTE_PATTERNS.filter((pattern) => pattern.test(src));
    expect(offenders).toEqual([]);
  });
});
