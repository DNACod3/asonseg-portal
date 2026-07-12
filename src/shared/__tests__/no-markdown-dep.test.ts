import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CASCA59-MN-03 — Renderer de Markdown de termos sem dependência nova
 * (USP-059, T4). `TermMarkdown`/`parseTermMarkdown` (`shared/ui`) SHALL NOT
 * depender de nenhuma lib de Markdown — `package.json` não pode listar
 * `react-markdown`/`remark`/`rehype`/`marked`/`markdown-it` (CLAUDE.md
 * "Forbidden"; mesmo padrão de `ds-no-forbidden-deps.test.ts`).
 */

const PACKAGE_JSON_PATH = join(process.cwd(), 'package.json');
const FORBIDDEN_MARKDOWN_LIBS = ['react-markdown', 'remark', 'rehype', 'marked', 'markdown-it'];

describe('CASCA59-MN-03 — sem dependência de Markdown (react-markdown/remark/rehype/marked/markdown-it)', () => {
  it('package.json (deps + devDeps) não lista nenhuma lib de Markdown proibida', () => {
    const raw = readFileSync(PACKAGE_JSON_PATH, 'utf-8');
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
    const offenders = deps.filter((d) =>
      FORBIDDEN_MARKDOWN_LIBS.some((forbidden) => d === forbidden || d.startsWith(`${forbidden}/`)),
    );
    expect(offenders).toEqual([]);
  });
});
