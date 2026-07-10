import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Guarda estática H4b (must-not MN-H4, Fase 6 — hardening): proíbe `console.*`
 * em `src/modules/**` e `src/shared/**` — todo log de módulo deve passar pelo
 * pino redator (`childLogger`/`logger`, H4), nunca contornar a redação de PII.
 * Mesmo mecanismo `fs` recursivo dos outros guards estáticos do repo.
 *
 * **Allowlist:**
 *  - `src/modules/identity/actions/registerPerson.ts` e `.../acceptRoleConsent.ts`
 *    — `console.error` pré-existentes (rollback/erro), migração follow-up para
 *    `childLogger` (fora do escopo desta unidade — ver design.md §H4b).
 *  - `src/middleware.ts` não entra na varredura (fica fora de `modules`/`shared`)
 *    mas é permanente por desenho: roda no Edge, onde o pino/Node não executa —
 *    emite JSON estruturado via `console.warn` com IP mascarado (ver `logRateLimited`).
 */

const SRC_ROOT = join(__dirname, '..', '..');
const MODULES_ROOT = join(SRC_ROOT, 'modules');
const SHARED_ROOT = join(SRC_ROOT, 'shared');

const CONSOLE_ALLOWLIST = new Set([
  join(MODULES_ROOT, 'identity', 'actions', 'registerPerson.ts'),
  join(MODULES_ROOT, 'identity', 'actions', 'acceptRoleConsent.ts'),
]);

const CONSOLE_REGEX = /console\.(log|info|warn|error|debug)\(/;

/** Lista recursiva de `.ts`/`.tsx`, excluindo `__tests__`/`.d.ts`/`.test.*`. */
function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      files.push(...listSourceFiles(full));
    } else if (
      (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
      !entry.endsWith('.d.ts') &&
      !entry.includes('.test.')
    ) {
      files.push(full);
    }
  }
  return files;
}

/** Predicado puro (H4b): `true` quando o arquivo NÃO viola a proibição de console.*. */
function isConsoleFree(source: string, absPath: string): boolean {
  if (CONSOLE_ALLOWLIST.has(absPath)) return true;
  return !CONSOLE_REGEX.test(source);
}

describe('H4b (must-not MN-H4) — sem console.* em src/modules e src/shared (fora da allowlist)', () => {
  const files = [...listSourceFiles(MODULES_ROOT), ...listSourceFiles(SHARED_ROOT)];

  it('sanity: a varredura encontra arquivos reais', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('árvore real: nenhum console.* fora da allowlist', () => {
    const violations: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      if (!isConsoleFree(source, file)) {
        violations.push(relative(SRC_ROOT, file));
      }
    }
    expect(violations).toEqual([]);
  });

  it('a allowlist cobre exatamente os 2 pontos pré-existentes (migração follow-up)', () => {
    expect(CONSOLE_ALLOWLIST.size).toBe(2);
  });
});

describe('H4b — isConsoleFree (predicado puro, entradas sintéticas)', () => {
  const SYNTHETIC_PATH = join(MODULES_ROOT, 'fake', 'actions', 'doSomething.ts');

  it('MN-H4: console.log(pessoa) fora da allowlist → violação (false)', () => {
    const source = `export function f(pessoa: unknown) { console.log(pessoa); }\n`;
    expect(isConsoleFree(source, SYNTHETIC_PATH)).toBe(false);
  });

  it.each(['console.log(', 'console.info(', 'console.warn(', 'console.error(', 'console.debug('])(
    '%s é detectado',
    (call) => {
      expect(isConsoleFree(`${call}"x");`, SYNTHETIC_PATH)).toBe(false);
    },
  );

  it('fonte sem console.* → ok (true)', () => {
    const source = `import { childLogger } from '@/shared/lib/logger';\nexport function f() { childLogger({}).info('ok'); }\n`;
    expect(isConsoleFree(source, SYNTHETIC_PATH)).toBe(true);
  });

  it('fonte com console.* allowlisted (path pré-existente) → ok (true)', () => {
    const source = `console.error('rollback falhou');\n`;
    const allowlisted = join(MODULES_ROOT, 'identity', 'actions', 'registerPerson.ts');
    expect(isConsoleFree(source, allowlisted)).toBe(true);
  });
});
