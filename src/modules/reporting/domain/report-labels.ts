import type { ContentStatus } from '@/modules/moderation';

/**
 * Rótulos PT-BR canônicos de `ContentStatus` para os relatórios operacionais
 * (USP-058/REL-3 — G2). Valores **idênticos** ao map já existente em
 * `services/views/provider-service-row.view.ts` (forma masculina — spec A1):
 * este arquivo não inventa rótulo novo, só o torna reusável/exaustivo fora do
 * módulo `services` (nenhum map de `ContentStatus` era exportado antes desta
 * US — spec A2). O map de `jobs` (feminino, "Ativa") permanece intocado no
 * seu próprio painel — nenhuma consolidação cross-módulo aqui (fora de
 * escopo, spec "Out of Scope").
 *
 * Client-safe: só consts + `import type` — nenhum IO, nenhum import em
 * runtime de `@/modules/moderation` (mantém o Client Component livre do
 * hazard AD-019).
 */
export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: 'Rascunho',
  IN_MODERATION: 'Em moderação',
  AWAITING_ADJUSTMENTS: 'Aguardando ajustes',
  ACTIVE: 'Ativo',
  REJECTED: 'Rejeitado',
  PAUSED: 'Pausado',
  EXPIRED: 'Expirado',
  ARCHIVED: 'Arquivado',
  INACTIVATED: 'Inativado',
};

/** Rótulo PT-BR do marcador sintético de manifestações de interesse (R3/MP7). */
export const MANIFESTATIONS_STATUS_LABEL = 'Manifestações de interesse';

/**
 * Resolve o rótulo PT-BR de um valor de `ContentStatus`. Fallback = o
 * próprio token (nunca lança) — USP058-15/MN-01: um enum novo sem rótulo não
 * quebra em runtime, mas o teste de completude (`report-labels.test.ts`)
 * falha no CI antes do merge.
 */
export function labelContentStatus(value: string): string {
  return CONTENT_STATUS_LABELS[value as ContentStatus] ?? value;
}
