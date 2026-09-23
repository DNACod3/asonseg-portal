import {
  searchServices,
  listServiceCategories,
  countActiveServicesByCategory,
  listPersonServiceInterests,
} from '@/modules/services';
import type { CurrentPerson } from '@/modules/identity';
import { childLogger } from '@/shared/lib/logger';
import type { KpiItem } from '../_components/kpi-strip';
import type { QuickAction } from '../_components/quick-actions';
import type { Counter } from '../_components/counter-grid';

const log = childLogger({ module: 'inicio', loader: 'client' });

export interface RequestedServiceRow {
  id: string;
  serviceId: string;
  serviceTitle: string;
  providerName: string;
  interestedAt: Date;
  active: boolean;
}

export interface ClientPanelData {
  kpis: KpiItem[];
  quickActions: QuickAction[];
  categoryCounters: Counter[];
  requestedServices: RequestedServiceRow[];
  requestedServicesTotal: number;
}

/**
 * Carrega o bloco CLIENT do painel `/inicio` (USP-067 — PNL-03). Cada
 * dimensão degrada isoladamente. KPI "em andamento" é **omitido** (A-05 —
 * `ServiceInterest` não tem estado de progresso).
 */
export async function loadClientPanel(person: CurrentPerson): Promise<ClientPanelData> {
  const [availableTotal, categoryCount, categoryCounts, interestRows] = await Promise.all([
    searchServices({}, person)
      .then((r) => r.total)
      .catch((err) => {
        log.error({ err }, 'client:available-services-failed');
        return 0;
      }),
    listServiceCategories()
      .then((cats) => cats.length)
      .catch((err) => {
        log.error({ err }, 'client:categories-count-failed');
        return 0;
      }),
    countActiveServicesByCategory().catch((err) => {
      log.error({ err }, 'client:categories-by-count-failed');
      return [];
    }),
    listPersonServiceInterests(person.id).catch((err) => {
      log.error({ err }, 'client:requested-services-failed');
      return [];
    }),
  ]);

  const requestedActiveCount = interestRows.filter((row) => row.active).length;

  const kpis: KpiItem[] = [
    { label: 'Serviços disponíveis', value: availableTotal, tone: 'primary' },
    { label: 'Tipos de serviço', value: categoryCount, tone: 'muted' },
    { label: 'Serviços solicitados', value: requestedActiveCount, tone: 'success' },
  ];

  const quickActions: QuickAction[] = [{ label: 'Buscar serviços', href: '/servicos', variant: 'primary' }];

  const categoryCounters: Counter[] = categoryCounts.map((category) => ({
    value: category.count,
    label: category.name,
    href: `/servicos?categoria=${category.categoryId}`,
  }));

  return {
    kpis,
    quickActions,
    categoryCounters,
    requestedServices: interestRows.slice(0, 5).map((row) => ({
      id: row.id,
      serviceId: row.serviceId,
      serviceTitle: row.serviceTitle,
      providerName: row.providerName,
      interestedAt: row.interestedAt,
      active: row.active,
    })),
    requestedServicesTotal: interestRows.length,
  };
}
