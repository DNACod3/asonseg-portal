import type { ContentKind } from './content-status';

export interface QueueKindCounts {
  /** Total de itens na fila (soma de todos os `contentKind`). */
  total: number;
  /** Contagem por `contentKind` — chave ausente = nenhum item daquele tipo. */
  byKind: Partial<Record<ContentKind, number>>;
}

/**
 * Deriva os contadores da fila de moderação por `contentKind`, a partir das
 * linhas já carregadas de `viewModerationQueue` (USP-067 — PNL-05/06/07 /
 * A-14) — os contadores do painel batem exatamente com a fila exibida (sem
 * usar `reportModerationQueue`, que tem status/escopo diferentes). Puro, sem
 * IO.
 */
export function countQueueByKind(items: readonly { contentKind: ContentKind }[]): QueueKindCounts {
  const byKind: Partial<Record<ContentKind, number>> = {};
  for (const item of items) {
    byKind[item.contentKind] = (byKind[item.contentKind] ?? 0) + 1;
  }
  return { total: items.length, byKind };
}
