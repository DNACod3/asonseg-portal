import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * USP-067 — T19 / PNL-MN-06 (+ reforço PNL-MN-07): as 8 leituras novas
 * (N1..N8, design.md "Leituras novas (GAP)") introduzidas por esta feature
 * são estritamente read-only — nenhum verbo de escrita do Prisma
 * (`create`/`update`/`delete`/`upsert`/`*Many` de escrita/`$executeRaw*`).
 * A ausência de migração nova (`prisma/migrations/**`) é verificada no DoD
 * do PR (`git diff --name-only origin/master...HEAD -- prisma/migrations`
 * vazio) — não repetida aqui como assert de CI porque depende de estado de
 * rede/remoto (fora do escopo determinístico de um guard estático local).
 */

const QUERY_FILES = [
  join(process.cwd(), 'src/modules/persons/queries/get-candidate-profile-status.ts'),
  join(process.cwd(), 'src/modules/persons/queries/get-provider-profile-status.ts'),
  join(process.cwd(), 'src/modules/services/queries/count-active-services-by-category.ts'),
  join(process.cwd(), 'src/modules/jobs/queries/count-company-applications.ts'),
  join(process.cwd(), 'src/modules/jobs/queries/list-company-recent-applications.ts'),
  join(process.cwd(), 'src/modules/referrals/queries/list-recent-referrals.ts'),
  join(process.cwd(), 'src/modules/reporting/queries/count-active-persons.ts'),
  join(process.cwd(), 'src/modules/jobs/queries/list-person-applications.ts'),
];

const WRITE_VERB_PATTERN =
  /\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$executeRawUnsafe/;

const ALLOWED_READ_CALL_PATTERN = /\.(?:findMany|findFirst|findUnique|count|groupBy|aggregate)\s*\(/;

describe('PNL-MN-06 — leituras novas N1..N8 são estritamente read-only', () => {
  it('varre as 8 queries novas do painel /inicio', () => {
    expect(QUERY_FILES.length).toBe(8);
  });

  it('nenhuma delas contém verbo de escrita do Prisma (create/update/delete/upsert/$executeRaw)', () => {
    const offenders = QUERY_FILES.map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
      .filter(({ content }) => WRITE_VERB_PATTERN.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('cada uma contém pelo menos uma chamada de leitura Prisma reconhecida (findMany/findFirst/findUnique/count/groupBy/aggregate)', () => {
    const offenders = QUERY_FILES.map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
      .filter(({ content }) => !ALLOWED_READ_CALL_PATTERN.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});

/**
 * Reforço estático de PNL-MN-07 (≤5): as leituras que retornam lista
 * (N5, N6 — as demais são count/aggregate/findUnique de 1 registro) usam
 * `take` com uma constante literal ≤5 no arquivo (não um valor dinâmico sem
 * teto). Ownership primário de PNL-MN-07 é T5/T6/T7 (query) + T11 (render) —
 * isto é reforço, não a fonte de verdade.
 */
const LIST_QUERY_FILES = [
  join(process.cwd(), 'src/modules/jobs/queries/list-company-recent-applications.ts'),
  join(process.cwd(), 'src/modules/referrals/queries/list-recent-referrals.ts'),
];

const TAKE_LEQ_5_PATTERN = /take:\s*(?:[1-5]\b|[A-Z_]+)/;

describe('PNL-MN-07 (reforço) — leituras de lista novas usam take ≤5', () => {
  it('list-company-recent-applications.ts e list-recent-referrals.ts declaram `take` com teto ≤5', () => {
    const offenders = LIST_QUERY_FILES.map((file) => ({ file, content: readFileSync(file, 'utf-8') }))
      .filter(({ content }) => !TAKE_LEQ_5_PATTERN.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
