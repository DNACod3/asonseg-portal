import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * US-111 / AC-111-2 — teste estrutural que ancora
 * `docs/operacao/checklist-empresa-fantasma.md` (já existe; esta unidade só
 * escreve o teste-fonte que faltava). Confirma que o doc existe e contém os
 * critérios verificáveis exigidos pelo AC: CNPJ, razão social, endereço, e a
 * decisão aprovar/rejeitar com motivo.
 */

const DOC_PATH = join(process.cwd(), 'docs/operacao/checklist-empresa-fantasma.md');

describe('AC-111-2 — checklist de empresa-fantasma (doc estrutural)', () => {
  it('existe: docs/operacao/checklist-empresa-fantasma.md está presente', () => {
    expect(existsSync(DOC_PATH)).toBe(true);
  });

  it('criterios: contém CNPJ, razão social, endereço e a decisão aprovar/rejeitar com motivo', () => {
    const content = readFileSync(DOC_PATH, 'utf8');

    expect(content).toMatch(/CNPJ/);
    expect(content).toMatch(/[Rr]azão social/);
    expect(content).toMatch(/[Ee]ndereço/);
    expect(content).toMatch(/[Aa]provar/);
    expect(content).toMatch(/[Rr]ejeitar/);
    expect(content).toMatch(/justificativa/);
  });
});
