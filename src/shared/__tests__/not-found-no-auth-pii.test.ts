import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CASCA59-MN-01 — Página 404 sem sessão/PII (USP-059, T1).
 *
 * `src/app/not-found.tsx` é chrome público estático — ela SHALL NOT
 * consumir sessão, `getCurrentPerson`, View Models, Prisma, Server Actions,
 * nem declarar `'use server'` (mesmo padrão de `casca-no-auth-pii.test.ts`
 * da USP-046, aplicado ao arquivo raiz do 404 global).
 */

const NOT_FOUND_PATH = join(process.cwd(), 'src/app/not-found.tsx');

const FORBIDDEN_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'getCurrentPerson', pattern: /\bgetCurrentPerson\b/ },
  { name: 'requireActivePerson', pattern: /\brequireActivePerson\b/ },
  { name: 'View Models (@/modules/*/views)', pattern: /@\/modules\/[^'"]*\/views/ },
  { name: 'Prisma (@/shared/lib/prisma)', pattern: /@\/shared\/lib\/prisma/ },
  { name: 'Server Actions (@/modules/*/actions)', pattern: /@\/modules\/[^'"]*\/actions/ },
  { name: "'use server'", pattern: /['"]use server['"]/ },
];

describe('CASCA59-MN-01 — 404 global sem sessão/PII/Prisma/View Model/Server Action', () => {
  const content = readFileSync(NOT_FOUND_PATH, 'utf-8');

  it.each(FORBIDDEN_PATTERNS)('not-found.tsx não referencia $name', ({ pattern }) => {
    expect(pattern.test(content)).toBe(false);
  });
});
