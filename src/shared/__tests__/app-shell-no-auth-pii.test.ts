import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * APP-SHELL-MN-03 — Casca de navegação da área logada (USP-061, T6).
 *
 * A casca `(app)/_components/**` deve renderizar identidade puramente a
 * partir de props passados pelo composition-root (`(app)/layout.tsx`) — ela
 * SHALL NOT importar `prisma` / `getCurrentPerson` / `requireActivePerson` /
 * View Models de qualquer módulo / Server Actions de qualquer módulo /
 * declarar `'use server'`. Previne renderizar PII de uma Pessoa que não é
 * a da sessão na chrome global (classe de vazamento — ver MEMORY
 * "Anonimizar no View Model não basta"). Molde: `casca-no-auth-pii.test.ts`
 * (mesmo collector recursivo, mesma lista de padrões), aplicado ao
 * diretório da casca `(app)`. Varre TODOS os arquivos do diretório (pega
 * arquivos novos automaticamente).
 */

const APP_SHELL_DIR = join(process.cwd(), 'src/app/(app)/_components');
const SCANNED_EXTS = new Set(['.ts', '.tsx']);

const FORBIDDEN_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'getCurrentPerson', pattern: /\bgetCurrentPerson\b/ },
  { name: 'requireActivePerson', pattern: /\brequireActivePerson\b/ },
  { name: 'View Models (@/modules/*/views)', pattern: /@\/modules\/[^'"]*\/views/ },
  { name: 'Prisma (@/shared/lib/prisma)', pattern: /@\/shared\/lib\/prisma/ },
  { name: 'Server Actions (@/modules/*/actions)', pattern: /@\/modules\/[^'"]*\/actions/ },
  { name: "'use server'", pattern: /['"]use server['"]/ },
];

function collectAppShellFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectAppShellFiles(fullPath));
    } else if (SCANNED_EXTS.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('APP-SHELL-MN-03 — casca (app) sem sessão/PII/Prisma/View Model/Server Action', () => {
  const files = collectAppShellFiles(APP_SHELL_DIR);

  it('varre pelo menos os componentes esperados da casca', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('BNAV-MN-03/DNAV-MN-03 (USP-062/063): app-bottom-nav.tsx e nav-icons.tsx constam da varredura', () => {
    const scannedBasenames = files.map((f) => f.split('/').pop());
    expect(scannedBasenames).toContain('app-bottom-nav.tsx');
    expect(scannedBasenames).toContain('nav-icons.tsx');
  });

  it('DNAV-MN-03 (USP-063): app-desktop-menu.tsx consta da varredura', () => {
    const scannedBasenames = files.map((f) => f.split('/').pop());
    expect(scannedBasenames).toContain('app-desktop-menu.tsx');
  });

  it('SIDE-MN-03 (USP-064): app-sidebar.tsx consta da varredura', () => {
    const scannedBasenames = files.map((f) => f.split('/').pop());
    expect(scannedBasenames).toContain('app-sidebar.tsx');
  });

  it('PROF-MN-01 (USP-065): profile-menu.tsx consta da varredura', () => {
    const scannedBasenames = files.map((f) => f.split('/').pop());
    expect(scannedBasenames).toContain('profile-menu.tsx');
  });

  it.each(FORBIDDEN_PATTERNS)('nenhum arquivo da casca referencia $name', ({ pattern }) => {
    const offenders = files
      .map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
      .filter(({ content }) => pattern.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
