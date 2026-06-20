import type { JobListItem } from '../views/job-list-item.view';
import { JobCard } from './job-card';

/**
 * Lista de vagas da busca pública (USP-021). Renderiza os cartões ou o estado vazio.
 * Os itens já vêm projetados pelo View Model (anonimização por papel aplicada).
 */
export function JobList({ jobs }: Readonly<{ jobs: JobListItem[] }>) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="text-base font-medium text-gray-900">Nenhuma vaga encontrada</p>
        <p className="mt-1 text-sm text-gray-600">
          Tente ajustar os filtros ou limpar a busca para ver todas as vagas.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {jobs.map((job) => (
        <li key={job.id}>
          <JobCard job={job} />
        </li>
      ))}
    </ul>
  );
}
