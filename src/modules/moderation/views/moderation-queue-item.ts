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
   * Flag de **exibição** de Empresa não verificada (E-001 / P-002). Disparador do
   * painel de verificação (USP-017): `true` quando o conteúdo é uma vaga (`JOB`)
   * cuja Empresa ainda não foi verificada.
   */
  companyUnverified?: boolean;
  /**
   * Empresa dona da vaga (só para `JOB`) — chave para carregar o contexto de
   * verificação (dados, histórico de rejeições, diff) no painel da USP-017.
   */
  companyId?: string;
}
