import { describe, it, expect } from 'vitest';
import { ContentStatus } from '@/modules/moderation/domain/content-status';
import { CANDIDATE_STATUS_LABELS } from '../domain/candidate-status-labels';

/**
 * Unit test de `CANDIDATE_STATUS_LABELS` (USP-067 — T1 / PNL-01, A-04).
 * Import direto do arquivo (não do barrel `@/modules/persons`) — lição MEMORY
 * `coverage-gate-branch-loading-drop`: importar barrel puxa módulos
 * não-medidos ao grafo v8 e derruba o branch global <65%.
 */
describe('CANDIDATE_STATUS_LABELS (T1)', () => {
  it('cobre todos os valores de ContentStatus com um rótulo PT-BR não vazio', () => {
    for (const status of Object.values(ContentStatus)) {
      expect(CANDIDATE_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('não tem chave extra fora do enum ContentStatus', () => {
    const enumValues = new Set<string>(Object.values(ContentStatus));
    for (const key of Object.keys(CANDIDATE_STATUS_LABELS)) {
      expect(enumValues.has(key)).toBe(true);
    }
  });
});
