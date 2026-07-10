import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Guarda estática H3 (must-not MN-H3, Fase 6 — hardening): toda Server Action
 * `'use server'` em `**\/actions/*.ts` deve referenciar ao menos um símbolo de
 * gate de sessão/permissão, OU constar explicitamente na
 * `PUBLIC_ACTION_ALLOWLIST` (pública por desenho, com a própria defesa
 * documentada abaixo). Mesmo mecanismo de varredura `fs` de
 * `no-out-of-band-status-write.test.ts` (jobs/services): sem glob, `fs`
 * recursivo a partir de `src/modules`.
 *
 * **Limitação honesta** (mesma de `no-out-of-band-status-write`): o guard
 * prova **referência** a um símbolo de gate (ou allowlist), não a corretude
 * de sequência em todo caminho de execução. Ele barra a omissão mais comum —
 * uma action nova sem gate nenhum — não substitui revisão de código.
 */

const MODULES_ROOT = join(__dirname, '..', '..', 'modules');

const GATE_SYMBOLS = [
  'requirePermission(',
  'requireCoordinator(',
  'requireActivePerson(',
  'requireServiceAuthorization(',
  'getCurrentPerson(',
] as const;

/**
 * As 6 actions públicas por desenho — cada uma com a própria defesa (design.md
 * §H3). Nenhuma delas guarda por sessão porque a Pessoa ainda não está
 * autenticada nesse ponto do fluxo; a defesa é outra camada equivalente.
 */
const PUBLIC_ACTION_ALLOWLIST = new Set([
  // CAPTCHA fail-closed (ADR-0014) + Zod — auto-cadastro público.
  join(MODULES_ROOT, 'identity', 'actions', 'registerPerson.ts'),
  // Lockout durável (ADR-0029) + CAPTCHA adaptativo (H1, Fase 6) — pré-login.
  join(MODULES_ROOT, 'identity', 'actions', 'login.ts'),
  // CAPTCHA + teto por IP (categoria `passwordReset` do rate-limit) — pré-login.
  join(MODULES_ROOT, 'identity', 'actions', 'request-password-reset.ts'),
  // CAPTCHA fail-closed antes de qualquer I/O — pré-login.
  join(MODULES_ROOT, 'identity', 'actions', 'request-credential-claim.ts'),
  // Token OTP de uso único (GoTrue verifyOtp) — pré-login.
  join(MODULES_ROOT, 'identity', 'actions', 'reset-password.ts'),
  // Token HMAC verifyConsentToken(personId, role, sig), validado antes de
  // qualquer escrita — TX2 pré-auth do auto-cadastro (defesa em profundidade
  // U1-GUARD-01, não um buraco de autorização).
  join(MODULES_ROOT, 'identity', 'actions', 'acceptRoleConsent.ts'),
]);

/** Lista recursiva de `*.ts` sob `src/modules`, excluindo `__tests__`/`.d.ts`/`.test.ts`. */
function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      files.push(...listSourceFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts') && !entry.endsWith('.test.ts')) {
      files.push(full);
    }
  }
  return files;
}

const ACTIONS_SEGMENT = `${sep}actions${sep}`;

/** Filtra para arquivos que vivem dentro de um diretório `actions/` de algum módulo. */
function listActionFiles(dir: string): string[] {
  return listSourceFiles(dir).filter((f) => f.includes(ACTIONS_SEGMENT));
}

/** `true` quando o primeiro conteúdo significativo do arquivo é a diretiva `'use server'`. */
function startsWithUseServer(source: string): boolean {
  const firstStatement = source
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('//'));
  return firstStatement === "'use server';" || firstStatement === '"use server";';
}

/**
 * Predicado puro (H3): decide se uma Server Action segue a convenção
 * canônica — referencia um gate, ou está na allowlist pública, ou nem é uma
 * action entrypoint (`'use server'`).
 */
function isCanonicalActionGuarded(source: string, absPath: string): boolean {
  if (!startsWithUseServer(source)) return true; // não é action entrypoint
  if (PUBLIC_ACTION_ALLOWLIST.has(absPath)) return true; // pública por desenho
  return GATE_SYMBOLS.some((s) => source.includes(s));
}

describe('H3 (must-not MN-H3) — toda Server Action tem gate de sessão/permissão', () => {
  const files = listActionFiles(MODULES_ROOT);

  it('sanity: a varredura encontra arquivos de actions reais', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('árvore real: nenhuma action *\'use server\'* sem gate e fora da allowlist', () => {
    const violations: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      if (!isCanonicalActionGuarded(source, file)) {
        violations.push(relative(MODULES_ROOT, file));
      }
    }
    expect(violations).toEqual([]);
  });

  it('a allowlist cobre exatamente as 6 públicas por desenho', () => {
    expect(PUBLIC_ACTION_ALLOWLIST.size).toBe(6);
  });
});

describe('H3 — isCanonicalActionGuarded (predicado puro, entradas sintéticas)', () => {
  const SYNTHETIC_PATH = join(MODULES_ROOT, 'fake', 'actions', 'doSomething.ts');

  it('MN-H3: fonte \'use server\' sem gate e fora da allowlist → violação (false)', () => {
    const source = `'use server';\n\nexport async function doSomething() { return 1; }\n`;
    expect(isCanonicalActionGuarded(source, SYNTHETIC_PATH)).toBe(false);
  });

  it('fonte \'use server\' com getCurrentPerson( → ok (true)', () => {
    const source = `'use server';\n\nexport async function doSomething() { const p = await getCurrentPerson(); return p; }\n`;
    expect(isCanonicalActionGuarded(source, SYNTHETIC_PATH)).toBe(true);
  });

  it('fonte \'use server\' com requirePermission( → ok (true)', () => {
    const source = `'use server';\n\nexport async function doSomething() { requirePermission('x'); }\n`;
    expect(isCanonicalActionGuarded(source, SYNTHETIC_PATH)).toBe(true);
  });

  it('fonte \'use server\' allowlisted (sem gate) → ok (true)', () => {
    const source = `'use server';\n\nexport async function doSomething() { return 1; }\n`;
    const allowlisted = join(MODULES_ROOT, 'identity', 'actions', 'login.ts');
    expect(isCanonicalActionGuarded(source, allowlisted)).toBe(true);
  });

  it('fonte sem \'use server\' (helper interno) → ignorado, ok (true) mesmo sem gate', () => {
    const source = `export async function helper() { return 1; }\n`;
    expect(isCanonicalActionGuarded(source, SYNTHETIC_PATH)).toBe(true);
  });
});
