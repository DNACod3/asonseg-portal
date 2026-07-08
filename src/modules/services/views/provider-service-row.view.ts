import type { BadgeProps } from '@/shared/ui';
import type { ProviderServiceRow } from '../queries/list-provider-services';

/** Rótulo PT-BR + variante de `Badge` por status (USP-032, painel de gestão). Espelha `company-job-row.view.ts`. */
const STATUS_LABEL: Record<ProviderServiceRow['status'], string> = {
  DRAFT: 'Rascunho',
  IN_MODERATION: 'Em moderação',
  AWAITING_ADJUSTMENTS: 'Aguardando ajustes',
  ACTIVE: 'Ativo',
  REJECTED: 'Rejeitado',
  PAUSED: 'Pausado',
  EXPIRED: 'Expirado', // Nunca alcançado por Service (sem validade automática) — presente só p/ exaustividade do enum.
  ARCHIVED: 'Arquivado',
  INACTIVATED: 'Inativado',
};

const STATUS_BADGE_VARIANT: Record<ProviderServiceRow['status'], NonNullable<BadgeProps['variant']>> = {
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

/** Ações contextuais coerentes ao status (USP-032 — painel de gestão do prestador). */
export interface ProviderServiceRowActions {
  canEdit: boolean;
  canPause: boolean;
  canResume: boolean;
  canArchive: boolean;
}

function actionsForStatus(status: ProviderServiceRow['status']): ProviderServiceRowActions {
  switch (status) {
    case 'ACTIVE':
      return { canEdit: true, canPause: true, canResume: false, canArchive: true };
    case 'PAUSED':
      return { canEdit: false, canPause: false, canResume: true, canArchive: true };
    default:
      // DRAFT/IN_MODERATION/AWAITING_ADJUSTMENTS/REJECTED/ARCHIVED/INACTIVATED:
      // fora do escopo de ações desta US — `editService` só aceita serviço ACTIVE
      // (AC-032-1), e o fluxo de rascunho (criar/reenviar) já existe em
      // `/prestador/servicos/nova` (USP-029). Nenhuma ação leve aqui evita um
      // link/botão morto.
      return { canEdit: false, canPause: false, canResume: false, canArchive: false };
  }
}

export interface ProviderServiceRowView {
  id: string;
  title: string;
  status: ProviderServiceRow['status'];
  statusLabel: string;
  badgeVariant: NonNullable<BadgeProps['variant']>;
  publishedAt: Date | null;
  actions: ProviderServiceRowActions;
}

/** Projeta uma linha crua de `listProviderServices` para o formato de exibição do painel. */
export function viewProviderServiceRow(row: ProviderServiceRow): ProviderServiceRowView {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    statusLabel: STATUS_LABEL[row.status],
    badgeVariant: STATUS_BADGE_VARIANT[row.status],
    publishedAt: row.publishedAt,
    actions: actionsForStatus(row.status),
  };
}
