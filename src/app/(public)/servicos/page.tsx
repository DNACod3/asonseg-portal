import type { Metadata } from 'next';
import { getCurrentPerson } from '@/modules/identity';
import { listActiveRegions } from '@/modules/jobs';
import {
  ServiceSearchFilters,
  ServiceList,
  AsonsegDisclaimer,
  listServiceCategories,
  searchServices,
  type SearchServicesFilters,
  type ServiceSearchFilterValues,
} from '@/modules/services';
import { Button, FormHeader } from '@/shared/ui';

// ADR-0013/ADR-0019: listagem pública com ISR de 30min. A revalidação on-demand
// (`revalidatePath('/servicos')`) já é disparada por `transitionContent` quando
// um serviço entra/sai de ACTIVE (NextCacheInvalidation) — nada a cabear aqui.
export const revalidate = 1800;

export const metadata: Metadata = {
  title: 'Serviços | ASONSEG',
  description: 'Serviços oferecidos por prestadores da região norte de Florianópolis.',
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
 * Busca pública de serviços (USP-030 / AC-030-1..4). Server Component: lê os
 * filtros dos searchParams (URL compartilhável), resolve a Pessoa autenticada
 * (paridade de assinatura com `searchServices` — não influencia a projeção,
 * ADR-0010) e renderiza filtros + lista + paginação + termo de isenção da
 * ASONSEG (AC-030-4).
 */
export default async function ServicosPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;

  const values: ServiceSearchFilterValues = {
    q: first(sp.q),
    categoria: first(sp.categoria),
    regiao: first(sp.regiao),
    precoMin: first(sp.precoMin),
    precoMax: first(sp.precoMax),
  };
  const page = Math.max(1, Math.trunc(Number(first(sp.pagina) ?? '1')) || 1);

  const filters: SearchServicesFilters = {
    q: values.q,
    categoryId: values.categoria,
    regionId: values.regiao,
    priceMin: toAmount(values.precoMin),
    priceMax: toAmount(values.precoMax),
    page,
  };

  // Taxonomias + Pessoa autenticada em paralelo; a busca aceita o viewer por paridade.
  const [viewer, categories, regions] = await Promise.all([
    getCurrentPerson(),
    listServiceCategories(),
    listActiveRegions(),
  ]);
  const result = await searchServices(filters, viewer);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  /** Monta o href de uma página preservando os filtros atuais. */
  function pageHref(target: number): string {
    const params = new URLSearchParams();
    if (values.q) params.set('q', values.q);
    if (values.categoria) params.set('categoria', values.categoria);
    if (values.regiao) params.set('regiao', values.regiao);
    if (values.precoMin) params.set('precoMin', values.precoMin);
    if (values.precoMax) params.set('precoMax', values.precoMax);
    if (target > 1) params.set('pagina', String(target));
    const qs = params.toString();
    return qs ? `/servicos?${qs}` : '/servicos';
  }

  return (
    // USP-046 (CASCA-12): <main> agora vem do (public)/layout.tsx.
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <FormHeader
        title="Serviços"
        description="Serviços oferecidos por prestadores da região norte de Florianópolis. Use os filtros para encontrar o serviço ideal."
      />

      <AsonsegDisclaimer />

      <ServiceSearchFilters categories={categories} regions={regions} values={values} />

      <section className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted" aria-live="polite">
          {result.total === 0
            ? 'Nenhum serviço encontrado'
            : `${result.total} ${result.total === 1 ? 'serviço encontrado' : 'serviços encontrados'}`}
        </p>

        <ServiceList services={result.items} />

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
    </div>
  );
}
