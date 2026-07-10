import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CASCA-MN-04 — Casca de navegação pública (USP-046, T2).
 *
 * O menu mobile (`PublicNav`) usa só React nativo (`useState`) + SVG inline
 * — mesmo padrão do `ThemeToggle` (DS-14/DS-15). Esta guarda falha se
 * qualquer arquivo em `src/app/(public)/_components/**` importar lib de
 * ícone ou de estado global proibida. `ds-no-forbidden-deps.test.ts` já
 * cobre `package.json` (deps instaladas); esta guarda cobre o USO (import)
 * nos arquivos da casca especificamente — varre o diretório inteiro, não
 * uma lista fixa de arquivos, para pegar arquivos novos automaticamente.
 */

const CASCA_DIR = join(process.cwd(), 'src/app/(public)/_components');
const SCANNED_EXTS = new Set(['.ts', '.tsx']);
const FORBIDDEN_IMPORT_PATTERN =
  /from\s+['"](lucide-react|zustand|redux|react-redux|@reduxjs\/toolkit|mobx|jotai|next-themes)['"]/;

function collectCascaFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectCascaFiles(fullPath));
    } else if (SCANNED_EXTS.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('CASCA-MN-04 — casca pública sem lib de estado/ícone proibida', () => {
  it('varre pelo menos os componentes esperados da casca (nenhum ausente por engano)', () => {
    const files = collectCascaFiles(CASCA_DIR);
    expect(files.length).toBeGreaterThan(0);
  });

  it('nenhum arquivo de (public)/_components/** importa lucide-react/Redux/MobX/Zustand/Jotai/next-themes', () => {
    const files = collectCascaFiles(CASCA_DIR);
    const offenders = files
      .map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
      .filter(({ content }) => FORBIDDEN_IMPORT_PATTERN.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
