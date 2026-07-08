import Link from 'next/link';
import { Button, Card, Input, Label } from '@/shared/ui';
import type { ServiceCategoryOption } from '../queries/list-service-categories';
import type { RegionOption } from './service-form';

// `<select>` nativo não tem primitivo no DS — estilo por token, mesma superfície
// visual do `Input` (AD-014, mesmo padrão de `job-search-filters.tsx`/USP-021).
const selectClass =
  'w-full rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary';

/** Valores atuais dos filtros (vindos dos searchParams), p/ pré-selecionar o form. */
export interface ServiceSearchFilterValues {
  q?: string;
  categoria?: string;
  regiao?: string;
  precoMin?: string;
  precoMax?: string;
}

export interface ServiceSearchFiltersProps {
  categories: ServiceCategoryOption[];
  regions: RegionOption[];
  values: ServiceSearchFilterValues;
}

/**
 * Filtros da busca pública de serviços (USP-030 / AC-030-2). Form GET sem
 * JavaScript: submete os filtros como searchParams (URL compartilhável,
 * compatível com ISR/SSR). Espelha `JobSearchFilters`: busca textual + categoria
 * + região visíveis (P-002 não opressivo); faixa de preço em "Mais filtros"
 * recolhível. **Sem filtro de disponibilidade** (texto livre no MVP — deferido,
 * design USP-030 §2).
 */
export function ServiceSearchFilters({ categories, regions, values }: Readonly<ServiceSearchFiltersProps>) {
  const hasMoreFilters = Boolean(values.precoMin || values.precoMax);

  return (
    <form action="/servicos" method="get">
      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        {/* Busca textual (AC-030-3) */}
        <div>
          <Label htmlFor="q">Buscar serviço</Label>
          <Input
            id="q"
            name="q"
            type="search"
            placeholder="Ex.: jardinagem, encanador, aulas…"
            defaultValue={values.q ?? ''}
          />
        </div>

        {/* Prioritários: categoria + região (P-002) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="categoria">Categoria</Label>
            <select id="categoria" name="categoria" defaultValue={values.categoria ?? ''} className={selectClass}>
              <option value="">Todas as categorias</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="regiao">Região</Label>
            <select id="regiao" name="regiao" defaultValue={values.regiao ?? ''} className={selectClass}>
              <option value="">Todas as regiões</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mais filtros (recolhível, P-002) */}
        <details className="rounded-lg border border-border bg-background p-3" open={hasMoreFilters}>
          <summary className="cursor-pointer text-sm font-medium text-fg">Mais filtros</summary>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="precoMin">Valor mín.</Label>
              <Input
                id="precoMin"
                name="precoMin"
                type="number"
                min={0}
                step="0.01"
                placeholder="R$"
                defaultValue={values.precoMin ?? ''}
              />
            </div>
            <div>
              <Label htmlFor="precoMax">Valor máx.</Label>
              <Input
                id="precoMax"
                name="precoMax"
                type="number"
                min={0}
                step="0.01"
                placeholder="R$"
                defaultValue={values.precoMax ?? ''}
              />
            </div>
          </div>
        </details>

        <div className="flex gap-3">
          <Button type="submit" variant="primary">
            Filtrar
          </Button>
          <Button variant="outline" asChild>
            <Link href="/servicos">Limpar</Link>
          </Button>
        </div>
      </Card>
    </form>
  );
}
