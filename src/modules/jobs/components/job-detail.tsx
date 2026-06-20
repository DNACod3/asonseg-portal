import Link from 'next/link';
import { formatDate } from '@/shared/lib/time';
import type { JobDetail } from '../views/job-detail.view';

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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">{content}</p>
    </section>
  );
}

/**
 * Bloco de chamada à ação por papel (USP-022 / E-002/E-004/P-003). O serializer
 * (`viewJobDetail`) já decidiu o papel — aqui só renderiza. O botão "candidatar-se" é
 * **somente exibição**: o disparo da candidatura é da USP-025.
 */
function ApplyCta({ job }: Readonly<{ job: JobDetail }>) {
  if (job.canApply) {
    return (
      <button
        type="button"
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto"
      >
        Candidatar-se
      </button>
    );
  }
  if (job.showActivateCandidateCta) {
    return (
      <Link
        href="/candidato"
        className="inline-block rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Ative seu perfil candidato para se candidatar
      </Link>
    );
  }
  // Anônimo: caminho claro para criar conta (USP-001).
  return (
    <Link
      href="/cadastro"
      className="inline-block rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
    >
      Criar conta para candidatar-se
    </Link>
  );
}

/**
 * Apresentação do detalhe de uma vaga (USP-022). Consome o View Model já recortado por
 * papel: a Empresa vem anonimizada/real e o contador já respeita o limiar (E-003) — nenhum
 * dado restrito (nome real para anônimo) chega aqui (P-002). O contador só aparece quando
 * `applicationCount != null`.
 */
export function JobDetailView({ job }: Readonly<{ job: JobDetail }>) {
  const salary = salaryLabel(job.salary);
  const meta = [job.area, job.region, job.workRegime, job.contractType, job.educationLevel].filter(
    Boolean,
  );

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
        <p className="text-sm text-gray-600">{job.company.displayName}</p>

        {meta.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-2">
            {meta.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-1 text-base font-semibold text-gray-900">
          {salary ?? 'Salário a combinar'}
        </p>

        {job.applicationCount != null && (
          <p className="text-sm text-gray-500">
            {job.applicationCount} {job.applicationCount === 1 ? 'pessoa se candidatou' : 'pessoas se candidataram'}
          </p>
        )}
      </header>

      <Section title="Descrição" content={job.description} />
      <Section title="Requisitos" content={job.requirements} />
      <Section title="Benefícios" content={job.benefits} />

      {(job.location || job.validUntil) && (
        <dl className="grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 text-sm sm:grid-cols-2">
          {job.location && (
            <div>
              <dt className="font-medium text-gray-500">Local</dt>
              <dd className="text-gray-700">{job.location}</dd>
            </div>
          )}
          {job.validUntil && (
            <div>
              <dt className="font-medium text-gray-500">Válida até</dt>
              <dd className="text-gray-700">
                <time dateTime={job.validUntil.toISOString()}>{formatDate(job.validUntil)}</time>
              </dd>
            </div>
          )}
        </dl>
      )}

      <div className="border-t border-gray-100 pt-5">
        <ApplyCta job={job} />
      </div>
    </article>
  );
}
