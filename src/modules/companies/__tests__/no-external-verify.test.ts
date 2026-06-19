import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * P-005 / D-004 — rota única de verificação (USP-017 / AD-3).
 *
 * `companies.is_verified = true` só pode ser marcado pelo `CompanyVerifyHook`
 * (módulo `moderation`), dentro do tx de aprovação da 1ª vaga. NENHUM action,
 * adapter ou query do módulo `companies` pode marcar uma Empresa como verificada
 * — não há admin manual, API direta nem marcação automática fora do hook.
 *
 * Guarda estática: percorre os fontes de `companies` (exceto testes), remove os
 * blocos `select: { ... }` (onde `isVerified: true` significa "selecionar o
 * campo", não escrevê-lo) e exige que nenhum write Prisma (`data:`) atribua
 * `isVerified: true`. O único downgrade permitido em `companies` é
 * `isVerified: false` (rebaixamento da USP-015).
 */

const COMPANIES_DIR = join(process.cwd(), 'src/modules/companies');

/** Lista recursiva de `.ts`/`.tsx` sob `dir`, ignorando `__tests__`. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Remove blocos `select: { ... }` (com casamento de chaves) — leituras, não writes. */
function stripSelectBlocks(src: string): string {
  let result = '';
  let i = 0;
  while (i < src.length) {
    const idx = src.indexOf('select:', i);
    if (idx === -1) {
      result += src.slice(i);
      break;
    }
    result += src.slice(i, idx);
    // Avança até o `{` de abertura do bloco select.
    let j = src.indexOf('{', idx);
    if (j === -1) {
      result += src.slice(idx);
      break;
    }
    let depth = 0;
    for (; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    i = j; // pula o bloco select inteiro
  }
  return result;
}

describe('USP-017 P-005/D-004 — verificação só pelo hook (nenhuma rota em companies)', () => {
  it('nenhum fonte de companies escreve isVerified: true (só o hook de moderation marca)', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(COMPANIES_DIR)) {
      const withoutSelects = stripSelectBlocks(readFileSync(file, 'utf8'));
      if (/isVerified\s*:\s*true/.test(withoutSelects)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
