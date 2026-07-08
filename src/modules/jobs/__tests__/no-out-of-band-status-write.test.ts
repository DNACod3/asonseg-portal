import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Guarda estática U23-MN-07 (must-not, USP-023 / T6): nenhuma escrita de `Job.status`
 * fora de `PrismaJobStatusRepository` (o adapter da FSM) ou `editJob` (a única exceção
 * arquitetural documentada, D1/§3.5) — e `editJob` só escreve `status` com
 * `status: 'ACTIVE'` no `where` (a precondição que faz as vezes de guard da transição).
 *
 * Escopo: chamadas de **mutação** (`.update(`/`.updateMany(`/`$executeRaw` com `UPDATE`)
 * que gravam o campo `status` do model `Job`. `tx.job.create({ data: { status: 'DRAFT' } })`
 * (nascimento do rascunho em `create-job-draft.ts`/`submit-job-for-moderation.ts`) NÃO é
 * escrita "out-of-band" — é o estado inicial da entidade (default do schema), não um bypass
 * da FSM sobre um registro existente; por isso a varredura mira só `.update`/`.updateMany`/
 * `$executeRaw`, nunca `.create`.
 */

const JOBS_SRC_ROOT = join(__dirname, '..');
const ALLOWED_FILES = new Set([
  join(JOBS_SRC_ROOT, 'adapters', 'prisma-job-status.ts'),
  join(JOBS_SRC_ROOT, 'actions', 'edit-job.ts'),
]);

/** Lista recursiva de arquivos `.ts` sob `src/modules/jobs`, excluindo `__tests__`. */
function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      files.push(...listSourceFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Ocorrências de `.update(`/`.updateMany(` com um `status:` gravado no bloco `data:`
 * (nunca no `where:` — filtrar/ler por status, como `extend-job-validity.ts` faz para a
 * concorrência otimista, NÃO é uma escrita e não deve disparar a guarda).
 */
function findStatusMutations(source: string): string[] {
  const hits: string[] = [];
  const callRegex = /\.(updateMany|update)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = callRegex.exec(source))) {
    const windowEnd = Math.min(source.length, match.index + 600);
    const window = source.slice(match.index, windowEnd);
    const dataMatch = window.match(/data:\s*{([^}]*)}/);
    if (/\bstatus\s*:/.test(dataMatch?.[1] ?? '')) {
      hits.push(match[0]);
    }
  }
  // `$executeRaw`/`$executeRawUnsafe` com UPDATE ... SET ... status = ...
  const rawRegex = /\$executeRaw\w*\s*\(/g;
  while ((match = rawRegex.exec(source))) {
    const windowEnd = Math.min(source.length, match.index + 600);
    const window = source.slice(match.index, windowEnd);
    if (/UPDATE\s+jobs\b/i.test(window) && /\bstatus\s*=/.test(window)) {
      hits.push(match[0] + ' (raw SQL)');
    }
  }
  return hits;
}

describe('U23-MN-07 (must-not) — nenhuma escrita de Job.status fora do adapter/editJob', () => {
  const files = listSourceFiles(JOBS_SRC_ROOT).filter((f) => !ALLOWED_FILES.has(f));

  it('nenhum arquivo fora do adapter/editJob contém uma mutação de status', () => {
    const violations: { file: string; hits: string[] }[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const hits = findStatusMutations(source);
      if (hits.length > 0) {
        violations.push({ file: relative(JOBS_SRC_ROOT, file), hits });
      }
    }
    expect(violations).toEqual([]);
  });

  it('editJob só escreve status com "status: \'ACTIVE\'" no where (a precondição/guard da exceção)', () => {
    const editJobPath = join(JOBS_SRC_ROOT, 'actions', 'edit-job.ts');
    const source = readFileSync(editJobPath, 'utf8');

    // Extrai o bloco do updateMany que grava status (o único write de status permitido aqui).
    const callIndex = source.indexOf('tx.job.updateMany(');
    expect(callIndex).toBeGreaterThan(-1);
    const block = source.slice(callIndex, callIndex + 400);

    // O `where` do bloco deve conter a precondição status: 'ACTIVE'.
    const whereMatch = block.match(/where:\s*{([^}]*)}/);
    expect(whereMatch).not.toBeNull();
    expect(whereMatch?.[1]).toMatch(/status\s*:\s*'ACTIVE'/);
  });

  it('sanity: a varredura encontra pelo menos os dois arquivos permitidos (adapter + editJob existem)', () => {
    const all = listSourceFiles(JOBS_SRC_ROOT);
    for (const allowed of ALLOWED_FILES) {
      expect(all).toContain(allowed);
    }
  });
});
