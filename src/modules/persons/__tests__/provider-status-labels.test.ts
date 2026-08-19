import { describe, it, expect } from 'vitest';
// Import direto do arquivo (não do barrel `@/modules/moderation`) deliberado:
// evita puxar módulos não-medidos ao grafo de cobertura v8 (lição MEMORY
// `coverage-gate-branch-loading-drop`); ver comentário abaixo.
// eslint-disable-next-line no-restricted-imports
import { ContentStatus } from '@/modules/moderation/domain/content-status';
import { PROVIDER_STATUS_LABELS } from '../domain/provider-status-labels';

/**
 * Unit test de `PROVIDER_STATUS_LABELS` (USP-067 — T2 / PNL-02, A-04). Import
 * direto do arquivo (não do barrel) — lição MEMORY
 * `coverage-gate-branch-loading-drop`.
 */
describe('PROVIDER_STATUS_LABELS (T2)', () => {
  it('cobre todos os valores de ContentStatus com um rótulo PT-BR não vazio', () => {
    for (const status of Object.values(ContentStatus)) {
      expect(PROVIDER_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('não tem chave extra fora do enum ContentStatus', () => {
    const enumValues = new Set<string>(Object.values(ContentStatus));
    for (const key of Object.keys(PROVIDER_STATUS_LABELS)) {
      expect(enumValues.has(key)).toBe(true);
    }
  });
});
