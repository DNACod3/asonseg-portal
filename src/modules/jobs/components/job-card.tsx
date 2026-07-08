import { formatDate } from '@/shared/lib/time';
import { Badge, Card } from '@/shared/ui';
import type { JobListItem } from '../views/job-list-item.view';

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

/** Texto da faixa salarial (ou null se oculta/ausente — edge salaryVisible). */
function salaryLabel(salary: JobListItem['salary']): string | null {
  if (!salary) return null;
  const { min, max } = salary;
  if (min != null && max != null) {
    return min === max ? brl.format(min) : `${brl.format(min)} – ${brl.format(max)}`;
  }
  if (min != null) return `A partir de ${brl.format(min)}`;
  if (max != null) return `Até ${brl.format(max)}`;
  return null;
}

/**
 * Cartão de vaga na lista pública (USP-021). Mostra os dados projetados pelo View
 * Model — incluindo a Empresa já **anonimizada por papel** (E-004/P-001). O link
 * aponta para o detalhe (USP-022, rota a existir). Nenhum dado restrito (nome real
 * para anônimo, contato) chega aqui: o serializer já recortou (P-004).
 */
export function JobCard({ job }: Readonly<{ job: JobListItem }>) {
  const salary = salaryLabel(job.salary);
  const meta = [job.area, job.region, job.workRegime, job.contractType].filter(Boolean);

  return (
    <Card className="p-5">
      <a href={`/vagas/${job.id}`} className="block focus:outline-none focus:ring-2 focus:ring-primary">
        <h3 className="text-lg font-semibold text-fg">{job.title}</h3>
        <p className="mt-1 text-sm text-fg-muted">{job.company.displayName}</p>

        {meta.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {meta.map((tag) => (
              <li key={tag}>
                <Badge variant="gray">{tag}</Badge>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="font-medium text-fg">{salary ?? 'Salário a combinar'}</span>
          {job.publishedAt && (
            <time dateTime={job.publishedAt.toISOString()} className="text-fg-muted">
              {formatDate(job.publishedAt)}
            </time>
          )}
        </div>
      </a>
    </Card>
  );
}
