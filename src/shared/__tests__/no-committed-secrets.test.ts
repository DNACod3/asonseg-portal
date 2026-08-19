import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * F0-MN-05 / F0C-02 — nenhuma credencial real versionada (Fase 0 — Fundação,
 * WS-C, defensiva/defense-in-depth).
 *
 * **Premissa corrigida pelo orquestrador (verificado no git antes desta
 * task):** `.env.staging` NÃO está tracked (0 commits no histórico,
 * `git ls-files` limpo) e já está no `.gitignore` (que cobre `.env*` exceto
 * `.env.example`). O único `.env*` tracked é `.env.example` (placeholders).
 * **Não há vazamento** — logo não há `git rm --cached` a fazer nem credencial
 * a rotacionar. Esta guarda é só a redundância defensiva: varre TODO arquivo
 * **tracked** (`git ls-files`) por padrões de credencial **real**, com
 * allowlist explícita dos valores legítimos que NÃO são segredo:
 *
 *  - `.env.example` (placeholders) — coberto porque seus próprios valores
 *    (senha `postgres`, `sk-ant-dummy-key`, `re_dummy_key`, JWT demo) já caem
 *    nas listas de valores seguros abaixo — não por exclusão de caminho.
 *  - O **JWT demo público do Supabase** (issuer `supabase-demo`), usado no
 *    CI (`ci.yml`) e em `.env.example`/docs — é o par anon/service_role fixo
 *    e público de toda instalação local do Supabase CLI, não um segredo.
 *  - Chaves fake de CI/dev: `sk-ant-ci`, `sk-ant-dummy-key`, `sk-ant-test`,
 *    `re_dummy_key`, `re_ci`, `ci-service`/`ci-id`/`ci-key` (B2), senhas de
 *    Postgres locais bem-conhecidas (`postgres`, `ci`, `test`).
 *  - Chaves de teste oficiais do Turnstile (`1x...`/`2x...`/`3x0000...`) —
 *    documentadas publicamente pela Cloudflare, sempre passam/falham de forma
 *    previsível, nunca autenticam nada real.
 *
 * Qualquer OUTRO valor que bata nos padrões abaixo é tratado como possível
 * segredo real e falha a guarda.
 */

function trackedFiles(): string[] {
  const out = execFileSync('git', ['ls-files'], { cwd: process.cwd(), encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

const BINARY_EXTENSIONS = /\.(png|jpe?g|gif|ico|woff2?|ttf|eot|pdf|zip)$/i;

function readTextFile(path: string): string | null {
  if (BINARY_EXTENSIONS.test(path)) return null;
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null; // arquivo binário ou ilegível — fora do escopo desta guarda
  }
}

/**
 * Senhas de Postgres locais/CI/fixture conhecidas — nunca credencial de
 * produção. `...`/`<pwd>` são placeholders literais de template em docs
 * (nunca uma senha real: o char-class da regex já para no primeiro `.`/`<`
 * "de verdade", então só chegam aqui strings de placeholder mesmo).
 */
const SAFE_DB_PASSWORDS = new Set(['postgres', 'ci', 'test', 'p', '<pwd>', '...']);

/** Sufixos de `sk-ant-<sufixo>` que são fakes de dev/CI/fixture, não uma API key real. */
const SAFE_ANTHROPIC_SUFFIXES = new Set(['ci', 'dummy-key', 'test']);

/** Sufixos de `re_<sufixo>` (Resend) que são fakes de dev/CI/fixture. */
const SAFE_RESEND_SUFFIXES = new Set(['dummy_key', 'ci', 'test', 'x']);

interface Offender {
  file: string;
  reason: string;
}

function scanFile(file: string, content: string, offenders: Offender[]): void {
  // Postgres/pooler connection string com senha embutida.
  for (const m of content.matchAll(/postgres(?:ql)?:\/\/[^:@/\s]+:([^@/\s]+)@/g)) {
    const password = m[1] ?? '';
    if (!SAFE_DB_PASSWORDS.has(password)) {
      offenders.push({ file, reason: `senha de Postgres não-allowlisted: "${password}"` });
    }
  }

  // Chave da API Anthropic.
  for (const m of content.matchAll(/sk-ant-([A-Za-z0-9_-]+)/g)) {
    const suffix = m[1] ?? '';
    if (!SAFE_ANTHROPIC_SUFFIXES.has(suffix)) {
      offenders.push({ file, reason: `possível chave Anthropic real: "sk-ant-${suffix}"` });
    }
  }

  // Chave da API Resend.
  for (const m of content.matchAll(/\bre_([A-Za-z0-9_]+)\b/g)) {
    const suffix = m[1] ?? '';
    if (!SAFE_RESEND_SUFFIXES.has(suffix)) {
      offenders.push({ file, reason: `possível chave Resend real: "re_${suffix}"` });
    }
  }

  // JWT (Supabase anon/service_role) — só o demo público (issuer `supabase-demo`) é seguro.
  for (const m of content.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g)) {
    const token = m[0];
    const payloadSegment = token.split('.')[1] ?? '';
    let issuer: string | undefined;
    try {
      const json = Buffer.from(payloadSegment, 'base64url').toString('utf8');
      issuer = (JSON.parse(json) as { iss?: string }).iss;
    } catch {
      issuer = undefined;
    }
    if (issuer !== 'supabase-demo') {
      offenders.push({ file, reason: `JWT com issuer não-demo ("${issuer ?? 'desconhecido'}")` });
    }
  }
}

describe('F0-MN-05 — nenhuma credencial real versionada (guarda defensiva)', () => {
  // C6 (PR#294 rodada 2) — este caso varre TODO arquivo tracked (`git
  // ls-files`), custo O(arquivos tracked); em isolamento já consome ~50% do
  // `testTimeout` default (5000ms — 2.41s medidos), e sob a concorrência da
  // suíte cheia estoura, virando "flake conhecido". Um gate de segurança
  // cronicamente vermelho treina o revisor a ignorar o vermelho — no dia em
  // que ele ficar vermelho por um segredo real, vai parecer igual a este.
  // Orçamento explícito (60s) devolve o sinal binário: vermelho volta a
  // significar "tem segredo no repo", não "a suíte estava sob carga".
  it(
    'nenhum arquivo tracked contém um segredo real (allowlist de valores fake/demo)',
    () => {
      const offenders: Offender[] = [];

      for (const file of trackedFiles()) {
        const content = readTextFile(file);
        if (content === null) continue;
        scanFile(file, content, offenders);
      }

      expect(offenders).toEqual([]);
    },
    60_000,
  );

  it('.env.staging não está tracked (achado do audit WS-C — já corrigido/nunca vazou)', () => {
    const tracked = trackedFiles();
    expect(tracked).not.toContain('.env.staging');
  });

  it('.gitignore cobre .env* exceto .env.example', () => {
    const gitignore = readFileSync('.gitignore', 'utf8');
    expect(gitignore).toMatch(/^\.env$/m);
    expect(gitignore).toMatch(/^\.env\.\*$/m);
    expect(gitignore).toMatch(/^!\.env\.example$/m);
  });
});
