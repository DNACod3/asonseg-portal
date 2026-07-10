import { getHomeIndicators, HomeIndicatorsView, type HomeIndicators } from '@/modules/reporting';
import { childLogger } from '@/shared/lib/logger';

// ADR-0013: home com ISR de 10min (indicadores agregados são "tempo real" no
// contrato com a UI). On-demand revalidation via `revalidatePath('/')`
// (USP-041 / T6 — revalidateHomeIndicators, disparada a partir de
// transitionContent). REL41-MN-03: este piso nunca pode ultrapassar 600s —
// ver guard estático em reporting/__tests__/home-revalidate.test.ts.
export const revalidate = 600;

const log = childLogger({ module: 'reporting', fn: 'HomePage' });

/**
 * Fallback quando a query de indicadores falha (ADR-0026 — tolerância
 * on-read): a home nunca quebra por causa dos indicadores. `0` em cada
 * contador só é exibido como "Em breve" pelo próprio `HomeIndicatorsView`
 * (abaixo do limiar mínimo, REL41-MN-02) — nunca aparece um número cru.
 */
const FALLBACK_INDICATORS: HomeIndicators = {
  activeJobs: 0,
  activeCandidates: 0,
  verifiedCompanies: 0,
};

async function loadIndicators(): Promise<HomeIndicators> {
  try {
    return await getHomeIndicators();
  } catch (err) {
    log.error({ err }, 'reporting:home-indicators:load-failed');
    return FALLBACK_INDICATORS;
  }
}

export default async function HomePage() {
  const indicators = await loadIndicators();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 p-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">ASONSEG — Portal de Empregabilidade e Serviços</h1>
        <p className="text-base opacity-80">
          Ação Social Nossa Senhora de Guadalupe. Esqueleto do monolito modular inicializado.
        </p>
      </div>

      <HomeIndicatorsView indicators={indicators} />
    </main>
  );
}
