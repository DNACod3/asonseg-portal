import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import { listApprovedJobAreas, listActiveRegions, requireActiveResponsible } from '@/modules/jobs';
import {
  searchCandidates,
  CandidateSearchForm,
  CandidateSearchList,
  type CandidateSearchFilterValues,
  type SearchCandidatesFilters,
} from '@/modules/persons';
import { FormHeader } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

type RawSearchParams = Record<string, string | string[] | undefined>;

/** Primeiro valor de um searchParam (ignora repetições). */
function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.trim() ? v.trim() : undefined;
}

/**
 * Busca ativa de candidatos (USP-028 / CAN-04). Só o responsável ATIVO da
 * Empresa acessa (P-005/D-005) — `notFound()` senão, mesmo padrão de
 * `empresa/[empresaId]/vagas`. Filtros vêm da URL (`searchParams`) — form GET
 * sem JavaScript, compartilhável.
 */
export default async function CandidatosBuscaPage({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { empresaId } = await params;
  const viewer = await requireActivePerson();

  if (!(await requireActiveResponsible(viewer.id, empresaId))) {
    notFound();
  }

  const sp = await searchParams;
  const values: CandidateSearchFilterValues = {
    q: first(sp.q),
    area: first(sp.area),
    escolaridade: first(sp.escolaridade),
    disponibilidade: first(sp.disponibilidade),
    regiao: first(sp.regiao),
  };
  const page = Math.max(1, Math.trunc(Number(first(sp.pagina) ?? '1')) || 1);

  const filters: SearchCandidatesFilters = {
    q: values.q,
    areaId: values.area,
    educationLevel: values.escolaridade,
    availability: values.disponibilidade,
    regionId: values.regiao,
    page,
  };

  const [areas, regions, res] = await Promise.all([
    listApprovedJobAreas(),
    listActiveRegions(),
    searchCandidates(filters, viewer),
  ]);

  if (!res.ok) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <FormHeader
        title="Buscar candidatos"
        description="Encontre profissionais para suas vagas, mesmo sem candidatura recebida."
      />

      <CandidateSearchForm empresaId={empresaId} areas={areas} regions={regions} values={values} />

      <section className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted" aria-live="polite">
          {res.data.total === 0
            ? 'Nenhum candidato encontrado'
            : `${res.data.total} ${res.data.total === 1 ? 'candidato encontrado' : 'candidatos encontrados'}`}
        </p>

        <CandidateSearchList items={res.data.items} />
      </section>
    </main>
  );
}
