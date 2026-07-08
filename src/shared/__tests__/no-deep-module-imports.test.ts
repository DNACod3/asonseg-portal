import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F0-MN-02 / F0A-01 — barrel obrigatório entre módulos (Fase 0 — Fundação).
 *
 * Nenhum `.ts`/`.tsx` sob `src/modules/**` pode importar de outro módulo por
 * caminho profundo (`@/modules/<x>/<subpath>`) — só o barrel (`@/modules/<x>`).
 * A regra já existe como lint (`no-restricted-imports`, `eslint.config.*`); esta
 * guarda é a redundância CI-independente (mesmo padrão de
 * `src/modules/companies/__tests__/no-external-verify.test.ts`).
 *
 * **Exceção documentada (A-07 / nota de conformidade F0A-05):** os pontos em
 * `persons/components/{candidate-form,provider-form}.tsx`,
 * `jobs/components/job-form.tsx` e `services/components/service-form.tsx`
 * são Client Components que precisam importar uma Server Action diretamente
 * do arquivo-fonte, não do barrel do módulo alheio (`@/modules/identity` /
 * `@/modules/moderation`): o barrel reexporta
 * código server-only (identity: `./server/session` → `supabase/server.ts` →
 * `next/headers`, e `./ports/captchaVerifier` → `container.ts` →
 * `next-cache-invalidation.ts` → `next/cache`; moderation: mesmo container via
 * `transition-content.ts` → `shared/container.ts`), que o Next se recusa a
 * empacotar no bundle do cliente. **Verificado empiricamente**: rotear esses
 * imports pelo barrel quebra `npm run build` (`Failed to compile` — "You're
 * importing a component that needs 'next/headers'/'revalidatePath'... not
 * supported in the pages/ directory"). Não é drift a corrigir — é o mesmo
 * carve-out do composition root em `shared/container.ts` (que também importa
 * módulos por caminho profundo, documentado e fora de `src/modules/**`), só
 * que do outro lado da fronteira client/server. Cada import excepcionado
 * carrega o comentário de justificativa + `// eslint-disable-next-line
 * no-restricted-imports` imediatamente acima — a guarda trata isso como
 * exceção revisada, não como violação; qualquer OUTRO deep-import sem esse
 * comentário continua barrado.
 */

const MODULES_DIR = join(process.cwd(), 'src/modules');
const DISABLE_COMMENT = '// eslint-disable-next-line no-restricted-imports';
const DEEP_IMPORT_RE = /from\s+'@\/modules\/[^/']+\/[^']+'/;

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

describe('F0-MN-02 — módulos importam-se só pelo barrel (@/modules/<x>)', () => {
  it('nenhum deep-import de módulo sem a exceção documentada (eslint-disable-next-line + justificativa)', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(MODULES_DIR)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, idx) => {
        if (!DEEP_IMPORT_RE.test(line)) return;
        const previousLine = lines[idx - 1]?.trim() ?? '';
        if (previousLine === DISABLE_COMMENT) return; // exceção documentada e revisada
        offenders.push(`${file}:${idx + 1}: ${line.trim()}`);
      });
    }

    expect(offenders).toEqual([]);
  });

  it('a exceção documentada continua restrita aos 4 arquivos conhecidos (client/server boundary)', () => {
    const knownExceptionFiles = new Set<string>();

    for (const file of sourceFiles(MODULES_DIR)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, idx) => {
        if (!DEEP_IMPORT_RE.test(line)) return;
        const previousLine = lines[idx - 1]?.trim() ?? '';
        if (previousLine === DISABLE_COMMENT) knownExceptionFiles.add(file);
      });
    }

    expect([...knownExceptionFiles].sort()).toEqual(
      [
        join(MODULES_DIR, 'persons/components/candidate-form.tsx'),
        join(MODULES_DIR, 'persons/components/provider-form.tsx'),
        join(MODULES_DIR, 'jobs/components/job-form.tsx'),
        join(MODULES_DIR, 'services/components/service-form.tsx'),
      ].sort(),
    );
  });
});
