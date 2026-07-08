import Link from 'next/link';
import { Button, Card, Input, Label } from '@/shared/ui';
import type { JobAreaOption } from '../queries/list-approved-job-areas';
import type { RegionOption } from '../queries/list-active-regions';

// `<select>` nativo não tem primitivo no DS — estilo por token, mesma superfície
// visual do `Input` (AD-014, mesmo padrão de `job-form.tsx`/USP-020).
const selectClass =
  'w-full rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary';

/** Valores atuais dos filtros (vindos dos searchParams), p/ pré-selecionar o form. */
export interface JobSearchFilterValues {
  q?: string;
  area?: string;
  regiao?: string;
  regime?: string;
  contrato?: string;
  escolaridade?: string;
  salarioMin?: string;
  salarioMax?: string;
}

export interface JobSearchFiltersProps {
  areas: JobAreaOption[];
  regions: RegionOption[];
  values: JobSearchFilterValues;
}

/**
 * Filtros da busca pública de vagas (USP-021 / P-002). Form GET sem JavaScript:
 * submete os filtros como searchParams (URL compartilhável, compatível com ISR/SSR).
 * **P-002 (não opressivo):** busca textual + área + região visíveis; o restante
 * (regime, contrato, escolaridade, faixa salarial) fica em "Mais filtros" recolhível
 * via `<details>`. Mobile-first (público com baixo letramento — RNF 6.5).
 */
export function JobSearchFilters({ areas, regions, values }: Readonly<JobSearchFiltersProps>) {
  const hasMoreFilters = Boolean(
    values.regime || values.contrato || values.escolaridade || values.salarioMin || values.salarioMax,
  );

  return (
    <form action="/vagas" method="get">
      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        {/* Busca textual (E-003) */}
        <div>
          <Label htmlFor="q">Buscar vaga</Label>
          <Input
            id="q"
            name="q"
            type="search"
            placeholder="Ex.: padaria, atendente, limpeza…"
            defaultValue={values.q ?? ''}
          />
        </div>

        {/* Prioritários: área + região (P-002) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="area">Área</Label>
            <select id="area" name="area" defaultValue={values.area ?? ''} className={selectClass}>
              <option value="">Todas as áreas</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
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
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="regime">Regime</Label>
              <Input
                id="regime"
                name="regime"
                type="text"
                placeholder="Ex.: Presencial"
                defaultValue={values.regime ?? ''}
              />
            </div>
            <div>
              <Label htmlFor="contrato">Tipo de contrato</Label>
              <Input
                id="contrato"
                name="contrato"
                type="text"
                placeholder="Ex.: CLT, PJ"
                defaultValue={values.contrato ?? ''}
              />
            </div>
            <div>
              <Label htmlFor="escolaridade">Escolaridade</Label>
              <Input
                id="escolaridade"
                name="escolaridade"
                type="text"
                placeholder="Ex.: Ensino médio completo"
                defaultValue={values.escolaridade ?? ''}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="salarioMin">Salário mín.</Label>
                <Input
                  id="salarioMin"
                  name="salarioMin"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="R$"
                  defaultValue={values.salarioMin ?? ''}
                />
              </div>
              <div>
                <Label htmlFor="salarioMax">Salário máx.</Label>
                <Input
                  id="salarioMax"
                  name="salarioMax"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="R$"
                  defaultValue={values.salarioMax ?? ''}
                />
              </div>
            </div>
          </div>
        </details>

        <div className="flex gap-3">
          <Button type="submit" variant="primary">
            Filtrar
          </Button>
          <Button variant="outline" asChild>
            <Link href="/vagas">Limpar</Link>
          </Button>
        </div>
      </Card>
    </form>
  );
}
