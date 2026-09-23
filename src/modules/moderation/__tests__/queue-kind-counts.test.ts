import { describe, it, expect } from 'vitest';
import { ContentKind } from '../domain/content-status';
import { countQueueByKind } from '../domain/queue-kind-counts';

/**
 * Unit test de `countQueueByKind` (USP-067 — T9 / PNL-05/06/07, A-14).
 * Import direto do arquivo (não do barrel `@/modules/moderation`) — lição
 * MEMORY `coverage-gate-branch-loading-drop`.
 */
describe('countQueueByKind (T9)', () => {
  it('conta total e por contentKind', () => {
    const result = countQueueByKind([
      { contentKind: ContentKind.JOB },
      { contentKind: ContentKind.JOB },
      { contentKind: ContentKind.CV },
      { contentKind: ContentKind.CANDIDATE_PROFILE },
    ]);
    expect(result).toEqual({
      total: 4,
      byKind: { JOB: 2, CV: 1, CANDIDATE_PROFILE: 1 },
    });
  });

  it('fila vazia → total 0, byKind vazio', () => {
    const result = countQueueByKind([]);
    expect(result).toEqual({ total: 0, byKind: {} });
  });

  it('kind ausente na fila não aparece em byKind (chave ausente, não zero)', () => {
    const result = countQueueByKind([{ contentKind: ContentKind.SERVICE }]);
    expect(result.byKind.JOB).toBeUndefined();
    expect(result.byKind.SERVICE).toBe(1);
  });
});
