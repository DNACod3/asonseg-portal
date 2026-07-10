import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CASCA-MN-01 — Casca de navegação pública (USP-046, T4).
 *
 * A casca do grupo `(public)` (`SiteHeader`/`PublicNav`/`SiteFooter`) é
 * chrome público estático/navegacional — ela SHALL NOT consumir sessão,
 * `getCurrentPerson`, View Models, Prisma, Server Actions, nem declarar
 * `'use server'`. Isso previne o vazamento de PII/estado autenticado no
 * HTML público/ISR (lição: SELECT condicional ao papel, não anonimizar só
 * no View Model — ver MEMORY "Anonimizar no View Model não basta"). Varre
 * TODOS os arquivos do diretório (pega arquivos novos automaticamente).
 */

const CASCA_DIR = join(process.cwd(), 'src/app/(public)/_components');
const SCANNED_EXTS = new Set(['.ts', '.tsx']);

const FORBIDDEN_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'getCurrentPerson', pattern: /\bgetCurrentPerson\b/ },
  { name: 'requireActivePerson', pattern: /\brequireActivePerson\b/ },
  { name: 'View Models (@/modules/*/views)', pattern: /@\/modules\/[^'"]*\/views/ },
  { name: 'Prisma (@/shared/lib/prisma)', pattern: /@\/shared\/lib\/prisma/ },
  { name: 'Server Actions (@/modules/*/actions)', pattern: /@\/modules\/[^'"]*\/actions/ },
  { name: "'use server'", pattern: /['"]use server['"]/ },
];

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

describe('CASCA-MN-01 — casca pública sem sessão/PII/Prisma/View Model/Server Action', () => {
  const files = collectCascaFiles(CASCA_DIR);

  it('varre pelo menos os componentes esperados da casca', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(FORBIDDEN_PATTERNS)('nenhum arquivo da casca referencia $name', ({ pattern }) => {
    const offenders = files
      .map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
      .filter(({ content }) => pattern.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
