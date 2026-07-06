import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F0-MN-04 / F0B-01 — checklist de verificação SEM literal no JSX (Fase 0 —
 * Fundação, WS-B). Os itens vêm de `listVerificationChecklistItems()`
 * (fonte seedável — `verification_checklist_items`, T-B3/B3a), nunca de texto
 * embutido no componente. Trocar o conteúdo dos itens deve ser um
 * seed/UPDATE, nunca um redeploy — esta guarda falha se algum dos labels
 * canônicos (`docs/operacao/checklist-empresa-fantasma.md`) aparecer como
 * string literal em `verification-panel.tsx` ou `moderation-queue.tsx`.
 */

const COMPONENTS_DIR = join(process.cwd(), 'src/modules/moderation/components');

/** Labels canônicos semeados por `prisma/seeds/reference.ts` (A1-A4, B1-B4). */
const CANONICAL_LABELS = [
  'CNPJ válido e ativo',
  'Razão social compatível com o CNPJ',
  'Coerência razão social × atividade (CNAE) × vaga',
  'Sem cobrança ao candidato',
  'Contato verificável',
  'Endereço plausível',
  'Presença digital mínima',
  'Responsável identificável',
];

/** Labels da const default (fallback quando a tabela ainda não foi seedada). */
const FALLBACK_LABELS = [
  'CNPJ existe e está ativo (consulta manual à Receita/cartão CNPJ).',
  'Razão social confere com o CNPJ informado.',
  'Endereço é plausível e compatível com a atividade declarada.',
  'Sem indícios de empresa-fantasma (dados consistentes entre si).',
];

describe('F0-MN-04 — itens da checklist não estão hardcoded no JSX', () => {
  it('verification-panel.tsx não contém nenhum label canônico como string literal', () => {
    const source = readFileSync(join(COMPONENTS_DIR, 'verification-panel.tsx'), 'utf8');
    const offenders = [...CANONICAL_LABELS, ...FALLBACK_LABELS].filter((label) => source.includes(label));
    expect(offenders).toEqual([]);
  });

  it('moderation-queue.tsx não contém nenhum label canônico como string literal', () => {
    const source = readFileSync(join(COMPONENTS_DIR, 'moderation-queue.tsx'), 'utf8');
    const offenders = [...CANONICAL_LABELS, ...FALLBACK_LABELS].filter((label) => source.includes(label));
    expect(offenders).toEqual([]);
  });

  it('verification-panel.tsx renderiza `item.label` dinamicamente (não um texto fixo)', () => {
    const source = readFileSync(join(COMPONENTS_DIR, 'verification-panel.tsx'), 'utf8');
    expect(source).toMatch(/\{item\.label\}/);
  });
});
