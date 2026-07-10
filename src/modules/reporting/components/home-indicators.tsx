import { Card } from '@/shared/ui';
import { applyMinimumDisplay } from '../domain/indicators';
import type { HomeIndicators as HomeIndicatorsData } from '../queries/home-indicators';

interface IndicatorCardProps {
  label: string;
  value: number;
}

/**
 * Um card de indicador: aplica a regra de exibição mínima (E-003 /
 * REL41-MN-02) e nunca renderiza um número cru abaixo do limiar — mostra
 * "Em breve" em vez disso (inclusive `0`, o caso cold start).
 */
function IndicatorCard({ label, value }: IndicatorCardProps) {
  const display = applyMinimumDisplay(value);
  return (
    <Card className="flex flex-col items-center gap-1 text-center">
      <span className="text-3xl font-bold text-primary">
        {display.kind === 'value' ? display.value : 'Em breve'}
      </span>
      <span className="text-sm text-fg-muted">{label}</span>
    </Card>
  );
}

export interface HomeIndicatorsProps {
  indicators: HomeIndicatorsData;
}

/**
 * Cards apresentacionais dos 3 indicadores da home pública (USP-041 —
 * E-001/E-003). Recebe apenas os 3 inteiros de {@link HomeIndicatorsData} —
 * não há como este componente receber/renderizar PII (REL41-MN-01): a prop
 * é estruturalmente `number`, nunca um objeto de pessoa/empresa.
 */
export function HomeIndicators({ indicators }: HomeIndicatorsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="home-indicators">
      <IndicatorCard label="Vagas ativas" value={indicators.activeJobs} />
      <IndicatorCard label="Candidatos" value={indicators.activeCandidates} />
      <IndicatorCard label="Empresas verificadas" value={indicators.verifiedCompanies} />
    </div>
  );
}
