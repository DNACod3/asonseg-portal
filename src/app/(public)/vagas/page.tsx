import type { Metadata } from 'next';
import { getCurrentPerson } from '@/modules/identity';
import {
  JobSearchFilters,
  JobList,
  listApprovedJobAreas,
  listActiveRegions,
  searchJobs,
  type SearchJobsFilters,
  type JobSearchFilterValues,
} from '@/modules/jobs';
import { Button, FormHeader } from '@/shared/ui';

// ADR-0013/ADR-0019: listagem pública com ISR de 30min. A revalidação on-demand
// (`revalidatePath('/vagas')`) já é disparada por `transitionContent` quando uma
// vaga entra/sai de ACTIVE (NextCacheInvalidation) — nada a cabear aqui.
export const revalidate = 1800;

export const metadata: Metadata = {
  title: 'Vagas | ASONSEG',
  description: 'Vagas de emprego abertas na região norte de Florianópolis.',
};

type RawSearchParams = Record<string, string | string[] | undefined>;

/** Primeiro valor de um searchParam (ignora repetições). */
function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.trim() ? v.trim() : undefined;
}

/** Converte string de searchParam em número ≥ 0 (ou undefined se inválida). */
function toAmount(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Busca pública de vagas (USP-021 / #171). Server Component: lê os filtros dos
 * searchParams (URL compartilhável), resolve a Pessoa autenticada (decide a
 * anonimização — E-004/E-005) e renderiza filtros + lista + paginação. Anônimo é o
 * caso comum (rota pública); o nome real da Empresa nunca chega ao HTML do anônimo.
 */
export default async function VagasPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;

  const values: JobSearchFilterValues = {
    q: first(sp.q),
    area: first(sp.area),
    regiao: first(sp.regiao),
    regime: first(sp.regime),
    contrato: first(sp.contrato),
    escolaridade: first(sp.escolaridade),
    salarioMin: first(sp.salarioMin),
    salarioMax: first(sp.salarioMax),
  };
  const page = Math.max(1, Math.trunc(Number(first(sp.pagina) ?? '1')) || 1);

  const filters: SearchJobsFilters = {
    q: values.q,
    areaId: values.area,
    regionId: values.regiao,
    workRegime: values.regime,
    contractType: values.contrato,
    educationLevel: values.escolaridade,
    salaryMin: toAmount(values.salarioMin),
    salaryMax: toAmount(values.salarioMax),
    page,
  };

  // Taxonomias + Pessoa autenticada em paralelo; a busca depende do viewer (anonimização).
  const [viewer, areas, regions] = await Promise.all([
    getCurrentPerson(),
    listApprovedJobAreas(),
    listActiveRegions(),
  ]);
  const result = await searchJobs(filters, viewer);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  /** Monta o href de uma página preservando os filtros atuais. */
  function pageHref(target: number): string {
    const params = new URLSearchParams();
    if (values.q) params.set('q', values.q);
    if (values.area) params.set('area', values.area);
    if (values.regiao) params.set('regiao', values.regiao);
    if (values.regime) params.set('regime', values.regime);
    if (values.contrato) params.set('contrato', values.contrato);
    if (values.escolaridade) params.set('escolaridade', values.escolaridade);
    if (values.salarioMin) params.set('salarioMin', values.salarioMin);
    if (values.salarioMax) params.set('salarioMax', values.salarioMax);
    if (target > 1) params.set('pagina', String(target));
    const qs = params.toString();
    return qs ? `/vagas?${qs}` : '/vagas';
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <FormHeader
        title="Vagas de emprego"
        description="Oportunidades abertas na região norte de Florianópolis. Use os filtros para encontrar a vaga ideal."
      />

      <JobSearchFilters areas={areas} regions={regions} values={values} />

      <section className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted" aria-live="polite">
          {result.total === 0
            ? 'Nenhuma vaga encontrada'
            : `${result.total} ${result.total === 1 ? 'vaga encontrada' : 'vagas encontradas'}`}
        </p>

        <JobList jobs={result.items} />

        {totalPages > 1 && (
          <nav className="flex items-center justify-between pt-2" aria-label="Paginação">
            {page > 1 ? (
              <Button variant="outline" asChild>
                <a href={pageHref(page - 1)}>← Anterior</a>
              </Button>
            ) : (
              <span />
            )}
            <span className="text-sm text-fg-muted">
              Página {page} de {totalPages}
            </span>
            {page < totalPages ? (
              <Button variant="outline" asChild>
                <a href={pageHref(page + 1)}>Próxima →</a>
              </Button>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </main>
  );
}
