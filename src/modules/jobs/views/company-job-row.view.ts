import type { BadgeProps } from '@/shared/ui';
import { diasAteExpiracao } from '../domain/validade';
import type { CompanyJobRow } from '../queries/list-company-jobs';

/**
 * Janela de antecedência do badge "expira em N dias" (USP-024 / E-004 / P-003) —
 * sinal in-portal que não depende do e-mail. O upstream não fixa um número exato
 * de dias; escolhido 7 (mesma ordem de grandeza do aviso D-3 por e-mail, mas o
 * badge é um sinal mais cedo e sempre visível, não um evento único).
 */
const EXPIRY_BADGE_WINDOW_DAYS = 7;

/** Rótulo PT-BR + variante de `Badge` por status (USP-023 / T8, painel de gestão). */
const STATUS_LABEL: Record<CompanyJobRow['status'], string> = {
  DRAFT: 'Rascunho',
  IN_MODERATION: 'Em moderação',
  AWAITING_ADJUSTMENTS: 'Aguardando ajustes',
  ACTIVE: 'Ativa',
  REJECTED: 'Rejeitada',
  PAUSED: 'Pausada',
  EXPIRED: 'Expirada',
  ARCHIVED: 'Arquivada',
  INACTIVATED: 'Inativada',
};

const STATUS_BADGE_VARIANT: Record<CompanyJobRow['status'], NonNullable<BadgeProps['variant']>> = {
  DRAFT: 'gray',
  IN_MODERATION: 'blue',
  AWAITING_ADJUSTMENTS: 'orange',
  ACTIVE: 'green',
  REJECTED: 'gray',
  PAUSED: 'orange',
  EXPIRED: 'gray',
  ARCHIVED: 'gray',
  INACTIVATED: 'gray',
};

/** Ações contextuais coerentes ao status (spec.md — Painel de gestão, AC #1). */
export interface CompanyJobRowActions {
  canEdit: boolean;
  canPause: boolean;
  canUnpause: boolean;
  canArchive: boolean;
  canExtend: boolean;
  canSubmit: boolean;
}

function actionsForStatus(status: CompanyJobRow['status']): CompanyJobRowActions {
  switch (status) {
    case 'ACTIVE':
      return { canEdit: true, canPause: true, canUnpause: false, canArchive: true, canExtend: true, canSubmit: false };
    case 'PAUSED':
      return { canEdit: true, canPause: false, canUnpause: true, canArchive: true, canExtend: false, canSubmit: false };
    default:
      // DRAFT/AWAITING_ADJUSTMENTS/ARCHIVED/EXPIRED/IN_MODERATION/REJECTED/INACTIVATED:
      // fora do escopo de ações desta US — `editJob` só aceita vaga ACTIVE (E-001), e o
      // fluxo de rascunho (criar/reenviar) já existe em `/vagas/nova` (USP-020). Nenhuma
      // ação leve aqui evita um link/botão morto (submeter rascunho por `jobId` fica para
      // uma US de gestão de rascunho, fora do escopo de USP-023).
      return { canEdit: false, canPause: false, canUnpause: false, canArchive: false, canExtend: false, canSubmit: false };
  }
}

export interface CompanyJobRowView {
  id: string;
  title: string;
  status: CompanyJobRow['status'];
  statusLabel: string;
  badgeVariant: NonNullable<BadgeProps['variant']>;
  validUntil: Date | null;
  publishedAt: Date | null;
  actions: CompanyJobRowActions;
  /**
   * Dias até a expiração (USP-024 / E-004), só para vaga `ACTIVE` com `validUntil`
   * dentro da janela de aviso ({@link EXPIRY_BADGE_WINDOW_DAYS}) — `null` fora dela
   * (vaga não-ACTIVE, sem `validUntil`, ou validade confortavelmente distante).
   * O painel renderiza "expira em N dias" quando não-nulo (P-003, sinal in-portal).
   */
  expiraEmDias: number | null;
}

/** Projeta uma linha crua de `listCompanyJobs` para o formato de exibição do painel. */
export function viewCompanyJobRow(row: CompanyJobRow): CompanyJobRowView {
  // `diasAteExpiracao` espera um instante real como "hoje" (converte para SP
  // internamente via date-fns-tz) — `new Date()`, não `hojeSaoPaulo()` (que já
  // devolve o dia-calendário embalado em meia-noite UTC; reprocessá-lo pelo fuso
  // de SP deslocaria um dia para trás, o mesmo erro que `validadeStatus` evita
  // nas chamadas existentes, ex. `publish-job.schema.ts`).
  const expiraEmDias =
    row.status === 'ACTIVE' && row.validUntil ? diasAteExpiracao(row.validUntil, new Date()) : null;

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    statusLabel: STATUS_LABEL[row.status],
    badgeVariant: STATUS_BADGE_VARIANT[row.status],
    validUntil: row.validUntil,
    publishedAt: row.publishedAt,
    actions: actionsForStatus(row.status),
    expiraEmDias: expiraEmDias != null && expiraEmDias >= 0 && expiraEmDias <= EXPIRY_BADGE_WINDOW_DAYS ? expiraEmDias : null,
  };
}
