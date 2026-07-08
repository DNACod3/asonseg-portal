import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CVE-MN-05 (USP-040 / regra LLM do CLAUDE.md) — a porta `CVExtractor` é a
 * única via de acesso ao provedor de IA generativa; nenhum código de `src/`
 * fora do adapter Anthropic pode importar `@anthropic-ai/sdk` diretamente
 * (vendor lock-in / bypass da abstração). Guarda estática — varredura
 * recursiva + allowlist, mesmo template de
 * `companies/__tests__/no-external-verify.test.ts`.
 */

const SRC_DIR = join(process.cwd(), 'src');
const ALLOWLISTED_FILE = join(
  SRC_DIR,
  'modules/cv-extraction/adapters/anthropic-cv-extractor.ts',
);
const SDK_IMPORT_RE = /from\s+['"]@anthropic-ai\/sdk(\/[^'"]*)?['"]/;

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

describe('USP-040 / CVE-MN-05 — @anthropic-ai/sdk só no adapter allowlistado', () => {
  it('sanidade: o arquivo allowlistado existe', () => {
    expect(existsSync(ALLOWLISTED_FILE)).toBe(true);
  });

  it('nenhum arquivo de src/ (fora o adapter) importa @anthropic-ai/sdk', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC_DIR)) {
      if (file === ALLOWLISTED_FILE) continue;
      const src = readFileSync(file, 'utf8');
      if (SDK_IMPORT_RE.test(src)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('o adapter allowlistado de fato importa @anthropic-ai/sdk (a guarda discrimina — não é um allowlist vazio)', () => {
    const src = readFileSync(ALLOWLISTED_FILE, 'utf8');
    expect(SDK_IMPORT_RE.test(src)).toBe(true);
  });
});
