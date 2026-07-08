import Link from 'next/link';
import { formatDate } from '@/shared/lib/time';
import { Badge, Button, FormCard, FormSectionTitle } from '@/shared/ui';
import type { JobDetail } from '../views/job-detail.view';
import { ApplyToJobButton } from './apply-to-job-button';
import { CancelApplicationButton } from './cancel-application-button';

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

/** Texto da faixa salarial (ou null se oculta/ausente — edge salaryVisible). */
function salaryLabel(salary: JobDetail['salary']): string | null {
  if (!salary) return null;
  const { min, max } = salary;
  if (min != null && max != null) {
    return min === max ? brl.format(min) : `${brl.format(min)} – ${brl.format(max)}`;
  }
  if (min != null) return `A partir de ${brl.format(min)}`;
  if (max != null) return `Até ${brl.format(max)}`;
  return null;
}

/** Bloco de texto longo (descrição/requisitos/benefícios), só renderiza se houver conteúdo. */
function Section({ title, content }: Readonly<{ title: string; content: string | null }>) {
  if (!content) return null;
  return (
    <section>
      <FormSectionTitle>{title}</FormSectionTitle>
      <p className="whitespace-pre-line text-sm leading-relaxed text-fg-muted">{content}</p>
    </section>
  );
}

/**
 * Bloco de chamada à ação por papel (USP-022/025/026 / E-002/E-004/P-003). O
 * serializer (`viewJobDetail`) já decidiu o papel — aqui só renderiza. Quando
 * `job.canApply`, o botão é o `ApplyToJobButton` real (USP-025 — dispara a
 * candidatura) enquanto não há `myApplicationId`; havendo uma candidatura
 * ativa, mostra o `CancelApplicationButton` real (USP-026 — CAN-026-03).
 */
function ApplyCta({
  job,
  myApplicationId,
}: Readonly<{ job: JobDetail; myApplicationId: string | null }>) {
  if (job.canApply) {
    if (myApplicationId) {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-fg">Você já se candidatou a esta vaga.</p>
          <CancelApplicationButton applicationId={myApplicationId} />
        </div>
      );
    }
    return <ApplyToJobButton jobId={job.id} />;
  }
  if (job.showActivateCandidateCta) {
    return (
      <Button variant="primary" asChild>
        <Link href="/candidato">Ative seu perfil candidato para se candidatar</Link>
      </Button>
    );
  }
  // Anônimo: caminho claro para criar conta (USP-001).
  return (
    <Button variant="outline" asChild>
      <Link href="/cadastro">Criar conta para candidatar-se</Link>
    </Button>
  );
}

export interface JobDetailViewProps {
  job: JobDetail;
  /**
   * Id da candidatura ATIVA do viewer a esta vaga, já resolvida pela página
   * (Server Component — `getMyActiveApplication`, USP-025). `null`/omitido =
   * ainda não se candidatou (ou não é candidato). Ignorado quando `!job.canApply`.
   */
  myApplicationId?: string | null;
}

/**
 * Apresentação do detalhe de uma vaga (USP-022/025). Consome o View Model já recortado por
 * papel: a Empresa vem anonimizada/real e o contador já respeita o limiar (E-003) — nenhum
 * dado restrito (nome real para anônimo) chega aqui (P-002). O contador só aparece quando
 * `applicationCount != null`.
 */
export function JobDetailView({ job, myApplicationId = null }: Readonly<JobDetailViewProps>) {
  const salary = salaryLabel(job.salary);
  const meta = [job.area, job.region, job.workRegime, job.contractType, job.educationLevel].filter(
    Boolean,
  );

  return (
    <FormCard className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold text-fg">{job.title}</h1>
        <p className="text-sm text-fg-muted">{job.company.displayName}</p>

        {meta.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-2">
            {meta.map((tag) => (
              <li key={tag}>
                <Badge variant="gray">{tag}</Badge>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-1 text-base font-semibold text-fg">{salary ?? 'Salário a combinar'}</p>

        {job.applicationCount != null && (
          <p className="text-sm text-fg-muted">
            {job.applicationCount} {job.applicationCount === 1 ? 'pessoa se candidatou' : 'pessoas se candidataram'}
          </p>
        )}
      </header>

      <Section title="Descrição" content={job.description} />
      <Section title="Requisitos" content={job.requirements} />
      <Section title="Benefícios" content={job.benefits} />

      {(job.location || job.validUntil) && (
        <dl className="grid grid-cols-1 gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
          {job.location && (
            <div>
              <dt className="font-medium text-fg-muted">Local</dt>
              <dd className="text-fg">{job.location}</dd>
            </div>
          )}
          {job.validUntil && (
            <div>
              <dt className="font-medium text-fg-muted">Válida até</dt>
              <dd className="text-fg">
                <time dateTime={job.validUntil.toISOString()}>{formatDate(job.validUntil)}</time>
              </dd>
            </div>
          )}
        </dl>
      )}

      <div className="border-t border-border pt-5">
        <ApplyCta job={job} myApplicationId={myApplicationId} />
      </div>
    </FormCard>
  );
}
