import type { ContentStatus } from '@/modules/moderation';

/**
 * Rótulos PT-BR de `ContentStatus` para o KPI "status do perfil" do painel
 * `/inicio` (USP-067 — PNL-02 / A-04). Map local — mesma justificativa de
 * `candidate-status-labels.ts` (evita ciclo de módulo com `reporting`).
 */
export const PROVIDER_STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: 'Rascunho',
  IN_MODERATION: 'Em análise',
  AWAITING_ADJUSTMENTS: 'Aguardando ajustes',
  ACTIVE: 'Publicado',
  REJECTED: 'Reprovado',
  PAUSED: 'Pausado',
  EXPIRED: 'Expirado',
  ARCHIVED: 'Arquivado',
  INACTIVATED: 'Inativado',
};
