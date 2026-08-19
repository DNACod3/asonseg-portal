import Link from 'next/link';
import { ApplyToJobButton, CancelApplicationButton } from '@/modules/jobs';
import { Button } from '@/shared/ui';
import { formatDateOnly } from '@/shared/lib/time';
import type { CandidatePanelData } from '../_loaders/candidate';
import { KpiStrip } from './kpi-strip';
import { QuickActions } from './quick-actions';
import { DashboardCard } from './dashboard-card';
import { DashboardRow } from './dashboard-row';

export interface CandidateBlockProps {
  data: CandidatePanelData;
}

/**
 * Bloco CANDIDATE do painel `/inicio` (USP-067 — PNL-01). Apresentacional
 * puro — recebe o view-model pronto de `loadCandidatePanel`; nunca decide
 * visibilidade/acesso (isso já foi resolvido antes de o loader ser chamado).
 */
export function CandidateBlock({ data }: Readonly<CandidateBlockProps>) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-lg font-semibold text-fg">Candidato(a)</h2>
      <QuickActions actions={data.quickActions} />
      <KpiStrip items={data.kpis} />
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardCard
          title="Vagas que combinam com você"
          description="Mais recentes nas áreas do seu currículo"
          rows={data.matchingJobs.map((job) => (
            <DashboardRow
              key={job.id}
              title={job.title}
              subtitle={job.companyName}
              actions={
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/vagas/${job.id}`}>Ver detalhes</Link>
                  </Button>
                  <ApplyToJobButton jobId={job.id} />
                </>
              }
            />
          ))}
          footHref={data.matchingJobsTotal > 0 ? '/vagas' : undefined}
          countHint={`${data.matchingJobs.length} de ${data.matchingJobsTotal}`}
        />
        <DashboardCard
          title="Minhas candidaturas"
          description="Acompanhe o andamento e retire a candidatura quando quiser"
          rows={data.applications.map((application) => (
            <DashboardRow
              key={application.id}
              title={application.jobTitle}
              subtitle={application.companyName}
              meta={[
                application.active ? 'Ativa' : 'Histórica',
                `candidatou-se em ${formatDateOnly(application.appliedAt)}`,
              ]}
              actions={
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/vagas/${application.jobId}`}>Ver detalhes</Link>
                  </Button>
                  {application.active && <CancelApplicationButton applicationId={application.id} />}
                </>
              }
            />
          ))}
          countHint={`${data.applications.length} de ${data.applicationsTotal}`}
        />
      </div>
    </section>
  );
}
