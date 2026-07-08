import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Guarda estática SVC031-MN-03 (must-not, USP-031 / T031-4): a rota
 * `servicos/[id]/page.tsx` (corpo E `generateMetadata`) deriva SEMPRE de
 * `viewServiceDetail`/`serviceDetailJsonLd` — nunca uma 2ª consulta Prisma
 * própria que contorne o View Model e possa selecionar contato. Espelha o
 * espírito da fonte única de `viewJobDetail` (`jobs/views/job-detail.view.ts`).
 *
 * Escopo: (1) a rota importa os dois símbolos do barrel `@/modules/services`;
 * (2) a rota não contém nenhuma chamada `prisma.` (a única leitura é via
 * `getActiveServiceDetail`, que por sua vez usa `viewServiceDetail` como fonte
 * única de projeção); (3) o `select` de `get-service-detail.ts` nunca inclui
 * `phone`/`emailLogin` (SVC031-MN-01 — defesa em profundidade, a 1ª barreira
 * já é a query nem carregar o campo).
 */

const PAGE_PATH = join(
  process.cwd(),
  'src/app/(public)/servicos/[id]/page.tsx',
);
const QUERY_PATH = join(process.cwd(), 'src/modules/services/queries/get-service-detail.ts');

describe('SVC031-MN-03 — fonte única de anonimização do detalhe (viewServiceDetail)', () => {
  const pageSource = readFileSync(PAGE_PATH, 'utf8');
  const querySource = readFileSync(QUERY_PATH, 'utf8');

  it('a rota importa viewServiceDetail e serviceDetailJsonLd do barrel @/modules/services', () => {
    expect(pageSource).toMatch(/import\s*{[^}]*\bviewServiceDetail\b[^}]*}\s*from\s*'@\/modules\/services'/s);
    expect(pageSource).toMatch(/import\s*{[^}]*\bserviceDetailJsonLd\b[^}]*}\s*from\s*'@\/modules\/services'/s);
  });

  it('generateMetadata deriva de viewServiceDetail (não recalcula título/descrição da row crua)', () => {
    const metadataStart = pageSource.indexOf('export async function generateMetadata');
    const nextExport = pageSource.indexOf('\nexport ', metadataStart + 1);
    expect(metadataStart).toBeGreaterThan(-1);
    const metadataBlock = pageSource.slice(metadataStart, nextExport > -1 ? nextExport : undefined);
    expect(metadataBlock).toMatch(/viewServiceDetail\(row,\s*null\)/);
  });

  it('o JSON-LD injetado no <script> deriva de serviceDetailJsonLd(viewServiceDetail(row, null))', () => {
    expect(pageSource).toMatch(/serviceDetailJsonLd\(viewServiceDetail\(row,\s*null\)\)/);
  });

  it('a rota não contém nenhuma chamada `prisma.` própria (sem 2ª query que contorne o View Model)', () => {
    expect(pageSource).not.toMatch(/\bprisma\./);
  });

  it('a rota não seleciona/menciona phone ou emailLogin', () => {
    expect(pageSource).not.toMatch(/\bphone\b/i);
    expect(pageSource).not.toMatch(/\bemailLogin\b/i);
  });

  it('SVC031-MN-01: o select de get-service-detail.ts nunca inclui phone/emailLogin', () => {
    expect(querySource).not.toMatch(/\bphone\s*:\s*true/);
    expect(querySource).not.toMatch(/\bemailLogin\s*:\s*true/);
  });
});
