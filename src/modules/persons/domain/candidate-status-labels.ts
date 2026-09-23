import type { ContentStatus } from '@/modules/moderation';

/**
 * Rótulos PT-BR de `ContentStatus` para o KPI "status do currículo" do painel
 * `/inicio` (USP-067 — PNL-01 / A-04). Map local (não importa
 * `@/modules/reporting`, que já depende de `persons` — importar de volta
 * criaria ciclo de módulo) — mesmo padrão de duplicação intencional já
 * existente em `services/views/provider-service-row.view.ts` e
 * `reporting/domain/report-labels.ts` (cada módulo mantém seu próprio map,
 * client-safe: só consts + `import type`).
 */
export const CANDIDATE_STATUS_LABELS: Record<ContentStatus, string> = {
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
