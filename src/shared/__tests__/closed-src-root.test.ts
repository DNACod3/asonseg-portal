import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F0-MN-03 / F0A-02 — raiz `src/` fechada (Fase 0 — Fundação).
 *
 * `CLAUDE.md`/`project-guideline.md`: "Root `src/` structure is closed: only
 * `app/`, `modules/`, `shared/`. New top-level folders require an RFC." Esta
 * guarda falha se aparecer uma 4ª pasta de topo sem RFC — mesmo padrão de
 * `src/modules/companies/__tests__/no-external-verify.test.ts` (fs estático,
 * sem dependência de runtime).
 *
 * `src/__tests__/` foi realocado nesta mesma task (T-A2): `middleware.test.ts`
 * foi co-localizado como `src/middleware.test.ts` (ao lado do próprio
 * `middleware.ts`) e `no-deep-module-imports.test.ts` (T-A1) foi para
 * `src/shared/__tests__/` — a pasta `src/__tests__/` não existe mais.
 */

const SRC_DIR = join(process.cwd(), 'src');
const ALLOWED_TOP_LEVEL_DIRS = new Set(['app', 'modules', 'shared']);

describe('F0-MN-03 — raiz src/ fechada (só app/modules/shared)', () => {
  it('nenhuma pasta de topo além de app/modules/shared', () => {
    const topLevelDirs = readdirSync(SRC_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    const offenders = topLevelDirs.filter((dir) => !ALLOWED_TOP_LEVEL_DIRS.has(dir));

    expect(offenders).toEqual([]);
  });

  it('as 3 pastas canônicas existem (nenhuma foi renomeada/removida por engano)', () => {
    const topLevelDirs = new Set(
      readdirSync(SRC_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name),
    );

    for (const dir of ALLOWED_TOP_LEVEL_DIRS) {
      expect(topLevelDirs.has(dir), `pasta "${dir}" ausente de src/`).toBe(true);
    }
  });
});
