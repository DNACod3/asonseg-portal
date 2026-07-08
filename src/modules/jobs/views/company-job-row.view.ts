import type { BadgeProps } from '@/shared/ui';
import type { CompanyJobRow } from '../queries/list-company-jobs';

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
    case 'DRAFT':
    case 'AWAITING_ADJUSTMENTS':
      return { canEdit: true, canPause: false, canUnpause: false, canArchive: false, canExtend: false, canSubmit: true };
    default:
      // ARCHIVED/EXPIRED/IN_MODERATION/REJECTED/INACTIVATED: sem ações de reativação aqui.
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
}

/** Projeta uma linha crua de `listCompanyJobs` para o formato de exibição do painel. */
export function viewCompanyJobRow(row: CompanyJobRow): CompanyJobRowView {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    statusLabel: STATUS_LABEL[row.status],
    badgeVariant: STATUS_BADGE_VARIANT[row.status],
    validUntil: row.validUntil,
    publishedAt: row.publishedAt,
    actions: actionsForStatus(row.status),
  };
}
