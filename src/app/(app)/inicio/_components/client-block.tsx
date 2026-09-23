import Link from 'next/link';
import { Button } from '@/shared/ui';
import { formatDateOnly } from '@/shared/lib/time';
import type { ClientPanelData } from '../_loaders/client';
import { KpiStrip } from './kpi-strip';
import { QuickActions } from './quick-actions';
import { DashboardCard } from './dashboard-card';
import { DashboardRow } from './dashboard-row';
import { CounterGrid } from './counter-grid';

export interface ClientBlockProps {
  data: ClientPanelData;
}

/**
 * Bloco CLIENT do painel `/inicio` (USP-067 — PNL-03). Apresentacional puro —
 * recebe o view-model pronto de `loadClientPanel`.
 *
 * SPEC_DEVIATION: a linha de "últimos serviços solicitados" tem só "Ver
 * detalhes" (não um 2º botão "Solicitar novamente" chamando `manifestInterest`
 * inline). Reason: `ManifestInterestButton` exige `consentTerm` (termo LGPD
 * `SERVICE_HIRING` carregado server-side pela página `/servicos/[id]`) — não é
 * um dado que N1..N8 cobrem, e duplicar o fluxo de consentimento no painel
 * seria escopo novo fora de PNL-03. "Ver detalhes" leva à mesma superfície
 * onde `ManifestInterestButton` já funciona por completo (mesmo espírito do
 * texto do AC-P1.3-3: "Contatar navega a /servicos/[id]").
 */
export function ClientBlock({ data }: Readonly<ClientBlockProps>) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-lg font-semibold text-fg">Cliente</h2>
      <QuickActions actions={data.quickActions} />
      <KpiStrip items={data.kpis} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-base font-semibold text-fg">Prestadores por tipo de serviço</h3>
          </div>
          <CounterGrid counters={data.categoryCounters} />
        </div>
        <DashboardCard
          title="Últimos serviços solicitados"
          rows={data.requestedServices.map((row) => (
            <DashboardRow
              key={row.id}
              title={row.serviceTitle}
              subtitle={row.providerName}
              meta={[
                row.active ? 'Ativo' : 'Cancelado',
                `solicitado em ${formatDateOnly(row.interestedAt)}`,
              ]}
              actions={
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/servicos/${row.serviceId}`}>Ver detalhes</Link>
                </Button>
              }
            />
          ))}
          countHint={`${data.requestedServices.length} de ${data.requestedServicesTotal}`}
        />
      </div>
    </section>
  );
}
