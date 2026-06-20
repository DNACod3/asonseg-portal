import Link from 'next/link';
import type { JobAreaOption } from '../queries/list-approved-job-areas';
import type { RegionOption } from '../queries/list-active-regions';

const fieldClass =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

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
    <form
      action="/vagas"
      method="get"
      className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5"
    >
      {/* Busca textual (E-003) */}
      <div>
        <label className={labelClass} htmlFor="q">
          Buscar vaga
        </label>
        <input
          id="q"
          name="q"
          type="search"
          placeholder="Ex.: padaria, atendente, limpeza…"
          defaultValue={values.q ?? ''}
          className={fieldClass}
        />
      </div>

      {/* Prioritários: área + região (P-002) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="area">
            Área
          </label>
          <select id="area" name="area" defaultValue={values.area ?? ''} className={fieldClass}>
            <option value="">Todas as áreas</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="regiao">
            Região
          </label>
          <select id="regiao" name="regiao" defaultValue={values.regiao ?? ''} className={fieldClass}>
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
      <details className="rounded-lg border border-gray-100 bg-gray-50 p-3" open={hasMoreFilters}>
        <summary className="cursor-pointer text-sm font-medium text-gray-700">Mais filtros</summary>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="regime">
              Regime
            </label>
            <input
              id="regime"
              name="regime"
              type="text"
              placeholder="Ex.: Presencial"
              defaultValue={values.regime ?? ''}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="contrato">
              Tipo de contrato
            </label>
            <input
              id="contrato"
              name="contrato"
              type="text"
              placeholder="Ex.: CLT, PJ"
              defaultValue={values.contrato ?? ''}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="escolaridade">
              Escolaridade
            </label>
            <input
              id="escolaridade"
              name="escolaridade"
              type="text"
              placeholder="Ex.: Ensino médio completo"
              defaultValue={values.escolaridade ?? ''}
              className={fieldClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass} htmlFor="salarioMin">
                Salário mín.
              </label>
              <input
                id="salarioMin"
                name="salarioMin"
                type="number"
                min={0}
                step="0.01"
                placeholder="R$"
                defaultValue={values.salarioMin ?? ''}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="salarioMax">
                Salário máx.
              </label>
              <input
                id="salarioMax"
                name="salarioMax"
                type="number"
                min={0}
                step="0.01"
                placeholder="R$"
                defaultValue={values.salarioMax ?? ''}
                className={fieldClass}
              />
            </div>
          </div>
        </div>
      </details>

      <div className="flex gap-3">
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Filtrar
        </button>
        <Link
          href="/vagas"
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Limpar
        </Link>
      </div>
    </form>
  );
}
