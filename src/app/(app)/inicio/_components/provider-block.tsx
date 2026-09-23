import Link from 'next/link';
import { Badge, Button } from '@/shared/ui';
import type { ProviderPanelData } from '../_loaders/provider';
import { KpiStrip } from './kpi-strip';
import { QuickActions } from './quick-actions';
import { DashboardCard } from './dashboard-card';
import { DashboardRow } from './dashboard-row';
import { ResubmitServiceButton } from './resubmit-service-button';

export interface ProviderBlockProps {
  data: ProviderPanelData;
}

/**
 * Bloco PROVIDER do painel `/inicio` (USP-067 — PNL-02). Apresentacional
 * puro — recebe o view-model pronto de `loadProviderPanel`.
 */
export function ProviderBlock({ data }: Readonly<ProviderBlockProps>) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-lg font-semibold text-fg">Prestador(a)</h2>
      <QuickActions actions={data.quickActions} />
      <KpiStrip items={data.kpis} />
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardCard
          title="Pessoas interessadas em contratar você"
          rows={data.interests.map((interest) => (
            <DashboardRow
              key={interest.interestId}
              title={interest.clientName}
              subtitle={interest.serviceTitle}
              meta={[interest.phone ?? 'Sem telefone', interest.email ?? 'Sem e-mail']}
              actions={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/prestador/manifestacoes">Ver detalhes</Link>
                </Button>
              }
            />
          ))}
          footHref="/prestador/manifestacoes"
          countHint={`${data.interests.length} de ${data.interestsTotal}`}
        />
        <DashboardCard
          title="Meus serviços"
          rows={data.services.map((service) => (
            <DashboardRow
              key={service.id}
              title={
                <>
                  {service.title}
                  <Badge variant={service.badgeVariant}>{service.statusLabel}</Badge>
                </>
              }
              actions={
                <>
                  {service.canEdit && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/prestador/servicos/${service.id}/editar`}>Editar</Link>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/prestador/manifestacoes">Ver interessados</Link>
                  </Button>
                  {service.canResubmit && <ResubmitServiceButton serviceId={service.id} />}
                </>
              }
            />
          ))}
          footHref="/prestador/servicos"
          countHint={`${data.services.length} de ${data.servicesTotal}`}
        />
      </div>
    </section>
  );
}
