import Link from 'next/link';
import { Badge, Button, Card } from '@/shared/ui';
import { formatDateOnly } from '@/shared/lib/time';
import type { CompanyPanelData } from '../_loaders/company';
import { KpiStrip } from './kpi-strip';
import { QuickActions } from './quick-actions';
import { DashboardCard } from './dashboard-card';
import { DashboardRow } from './dashboard-row';
import { ResubmitJobButton } from './resubmit-job-button';

export interface CompanyBlockProps {
  data: CompanyPanelData;
}

/**
 * Bloco COMPANY_RESPONSIBLE do painel `/inicio` (USP-067 — PNL-04). Sem
 * empresa ativa (`hasActiveCompany: false`) → estado vazio + atalho
 * "cadastrar empresa" (P1.4-4). "Candidaturas recentes" nunca expõe
 * identidade do candidato (PNL-MN-02) — a linha só tem vaga + data; a ação
 * "Ver candidatos" leva à superfície auditada por vaga.
 */
export function CompanyBlock({ data }: Readonly<CompanyBlockProps>) {
  if (!data.hasActiveCompany) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-fg">Responsável de Empresa</h2>
        <Card className="flex flex-col items-start gap-3">
          <p className="text-sm text-fg-muted">Você ainda não tem uma Empresa ativa.</p>
          <QuickActions actions={data.quickActions} />
        </Card>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-lg font-semibold text-fg">Responsável de Empresa</h2>
      <QuickActions actions={data.quickActions} />
      <KpiStrip items={data.kpis} />
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardCard
          title="Minhas vagas"
          rows={data.jobs.map((job) => (
            <DashboardRow
              key={job.id}
              title={
                <>
                  {job.title}
                  <Badge variant={job.badgeVariant}>{job.statusLabel}</Badge>
                </>
              }
              actions={
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/empresa/${job.companyId}/vagas/${job.id}/candidatos`}>
                      Ver candidatos
                    </Link>
                  </Button>
                  {job.canEdit && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/empresa/${job.companyId}/vagas/${job.id}/editar`}>Editar</Link>
                    </Button>
                  )}
                  {job.canSubmit && <ResubmitJobButton jobId={job.id} />}
                </>
              }
            />
          ))}
          footHref={`/empresa/${data.jobs[0]?.companyId}/vagas`}
          countHint={`${data.jobs.length} de ${data.jobsTotal}`}
        />
        <DashboardCard
          title="Candidaturas recentes"
          description="Por vaga — a identidade do candidato só aparece na lista de candidatos"
          rows={data.recentApplications.map((row, index) => (
            <DashboardRow
              key={`${row.jobId}-${index}`}
              title={row.jobTitle}
              meta={[`candidatura em ${formatDateOnly(row.appliedAt)}`]}
              actions={
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/empresa/${row.companyId}/vagas/${row.jobId}/candidatos`}>
                    Ver candidatos
                  </Link>
                </Button>
              }
            />
          ))}
          countHint={`${data.recentApplications.length} de ${data.recentApplicationsTotal}`}
        />
      </div>
    </section>
  );
}
