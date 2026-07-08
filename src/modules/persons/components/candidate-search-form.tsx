import Link from 'next/link';
import { Button, Card, Input, Label } from '@/shared/ui';
import type { JobAreaOption, RegionOption } from '@/modules/jobs';
import { EDUCATION_LEVELS, EDUCATION_LEVEL_LABELS } from '../domain/candidate';

// `<select>` nativo não tem primitivo no DS — estilo por token, mesma superfície
// visual do `Input` (AD-014, mesmo padrão de `job-search-filters.tsx`).
const selectClass =
  'w-full rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary';

/** Valores atuais dos filtros (vindos dos searchParams), p/ pré-selecionar o form. */
export interface CandidateSearchFilterValues {
  q?: string;
  area?: string;
  escolaridade?: string;
  disponibilidade?: string;
  regiao?: string;
}

export interface CandidateSearchFormProps {
  empresaId: string;
  areas: JobAreaOption[];
  regions: RegionOption[];
  values: CandidateSearchFilterValues;
}

/**
 * Filtros da busca ativa de candidatos (USP-028 / P-002). Form GET sem
 * JavaScript: submete os filtros como searchParams (URL compartilhável),
 * mesmo padrão de `JobSearchFilters` (USP-021).
 */
export function CandidateSearchForm({
  empresaId,
  areas,
  regions,
  values,
}: Readonly<CandidateSearchFormProps>) {
  return (
    <form action={`/empresa/${empresaId}/candidatos`} method="get">
      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        <div>
          <Label htmlFor="q">Buscar candidato</Label>
          <Input
            id="q"
            name="q"
            type="search"
            placeholder="Ex.: atendimento, vendas, administrativo…"
            defaultValue={values.q ?? ''}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="area">Área de interesse</Label>
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
            <Label htmlFor="regiao">Localização</Label>
            <select id="regiao" name="regiao" defaultValue={values.regiao ?? ''} className={selectClass}>
              <option value="">Todas as regiões</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="escolaridade">Escolaridade</Label>
            <select
              id="escolaridade"
              name="escolaridade"
              defaultValue={values.escolaridade ?? ''}
              className={selectClass}
            >
              <option value="">Todas</option>
              {EDUCATION_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {EDUCATION_LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="disponibilidade">Disponibilidade</Label>
            <Input
              id="disponibilidade"
              name="disponibilidade"
              type="text"
              placeholder="Ex.: Período integral"
              defaultValue={values.disponibilidade ?? ''}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" variant="primary">
            Filtrar
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/empresa/${empresaId}/candidatos`}>Limpar</Link>
          </Button>
        </div>
      </Card>
    </form>
  );
}
