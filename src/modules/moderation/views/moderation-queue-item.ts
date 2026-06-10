import type { ContentKind } from '../domain/content-status';

/**
 * Item da fila de moderação exposto ao coordenador (E-001). View Model: só os
 * campos necessários para listar e decidir — sem vazar dados do conteúdo além do
 * título e do autor (privacidade — ADR-0010).
 */
export interface ModerationQueueItem {
  contentKind: ContentKind;
  contentId: string;
  title: string;
  /** Nome do autor (quando resolvível); `null` se a Pessoa não for encontrada. */
  authorName: string | null;
  submittedAt: Date;
  /**
   * Flag de **exibição** de Empresa não verificada (P-002). O painel de
   * verificação é da USP-017 — aqui é só indicador visual.
   */
  companyUnverified?: boolean;
}
