import {
  listProviderInterests,
  listProviderServices,
  viewProviderServiceRow,
  countRecentWithin7Days,
  type ProviderInterestView,
} from '@/modules/services';
import { getProviderProfileStatus, PROVIDER_STATUS_LABELS } from '@/modules/persons';
import type { CurrentPerson } from '@/modules/identity';
import { fail } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import type { KpiItem } from '../_components/kpi-strip';
import type { QuickAction } from '../_components/quick-actions';

const log = childLogger({ module: 'inicio', loader: 'provider' });

export interface ProviderInterestRow {
  interestId: string;
  clientName: string;
  phone: string | null;
  email: string | null;
  serviceTitle: string;
}

export interface ProviderServicePanelRow {
  id: string;
  title: string;
  statusLabel: string;
  badgeVariant: 'gray' | 'blue' | 'orange' | 'green';
  canEdit: boolean;
  /**
   * "Corrigir e reenviar" (`submitServiceForModeration`, P1.2-3). Derivado
   * localmente do status cru — `ProviderServiceRowActions` (view existente,
   * USP-032) não expõe este flag para `AWAITING_ADJUSTMENTS` (fora do escopo
   * daquela US); calculado aqui em vez de tocar o View Model compartilhado
   * (diff restrito a `inicio/` + queries novas).
   */
  canResubmit: boolean;
}

export interface ProviderPanelData {
  kpis: KpiItem[];
  quickActions: QuickAction[];
  interests: ProviderInterestRow[];
  interestsTotal: number;
  services: ProviderServicePanelRow[];
  servicesTotal: number;
}

function toInterestRow(view: ProviderInterestView): ProviderInterestRow {
  return {
    interestId: view.interestId,
    clientName: view.clientName,
    phone: view.contact.phone,
    email: view.contact.email,
    serviceTitle: view.service.title,
  };
}

/**
 * Carrega o bloco PROVIDER do painel `/inicio` (USP-067 — PNL-02). Cada
 * dimensão degrada isoladamente. `listProviderInterests` é chamado **1 única
 * vez** (audita `SENSITIVE_FIELD_VIEWED` on-read) — o resultado serve o KPI
 * "interessados" + "novos em 7 dias" + o card, nunca duplicado (risco
 * documentado no design).
 */
export async function loadProviderPanel(person: CurrentPerson): Promise<ProviderPanelData> {
  const [interestsResult, serviceRows, profileStatus] = await Promise.all([
    listProviderInterests(person).catch((err) => {
      log.error({ err }, 'provider:interests-failed');
      return fail('INTERNAL', 'Erro interno. Tente novamente mais tarde.');
    }),
    listProviderServices(person.id).catch((err) => {
      log.error({ err }, 'provider:services-failed');
      return [];
    }),
    getProviderProfileStatus(person.id).catch((err) => {
      log.error({ err }, 'provider:profile-status-failed');
      return null;
    }),
  ]);

  const interests = interestsResult.ok ? interestsResult.data.interests : [];
  const interestsTotal = interestsResult.ok ? interestsResult.data.total : 0;
  const recentWithin7Days = countRecentWithin7Days(interests);

  const activeServicesCount = serviceRows.filter((row) => row.status === 'ACTIVE').length;
  const profileStatusLabel = profileStatus ? PROVIDER_STATUS_LABELS[profileStatus] : 'Não enviado';

  const kpis: KpiItem[] = [
    { label: 'Pessoas interessadas', value: interestsTotal, tone: 'primary' },
    { label: 'Novos em 7 dias', value: recentWithin7Days, tone: 'cta' },
    { label: 'Serviços publicados', value: activeServicesCount, tone: 'success' },
    { label: 'Status do perfil', value: profileStatusLabel, tone: 'muted' },
  ];

  const quickActions: QuickAction[] = [
    { label: 'Cadastrar serviço', href: '/prestador/servicos/nova', variant: 'primary' },
    { label: 'Meus serviços', href: '/prestador/servicos', variant: 'outline' },
  ];

  const services: ProviderServicePanelRow[] = serviceRows.slice(0, 5).map((row) => {
    const view = viewProviderServiceRow(row);
    return {
      id: view.id,
      title: view.title,
      statusLabel: view.statusLabel,
      badgeVariant: view.badgeVariant,
      canEdit: view.actions.canEdit,
      canResubmit: row.status === 'AWAITING_ADJUSTMENTS',
    };
  });

  return {
    kpis,
    quickActions,
    interests: interests.slice(0, 5).map(toInterestRow),
    interestsTotal,
    services,
    servicesTotal: serviceRows.length,
  };
}
