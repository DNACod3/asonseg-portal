import Link from 'next/link';
import { HomeIndicatorsView, type HomeIndicators } from '@/modules/reporting';
import { Button, cn } from '@/shared/ui';
import { HomeFeaturedJobs, type FeaturedJob } from './home-featured-jobs';
import { HomeSearch } from './home-search';

/**
 * USP-047 (T7, HOME-01/HOME-02/HOME-05/HOME-13/HOME-MN-03). Hero: `<h1>` +
 * subtítulo + CTAs + busca (`HomeSearch`, T1) + destaque de vaga
 * (`HomeFeaturedJobs`, T2) + o `HomeIndicatorsView` real (USP-041,
 * inalterado) na posição dos "hero-stats" falsos do protótipo (A-03).
 * Layout de 2 colunas no desktop (conteúdo + visual), empilhado no mobile,
 * fiel a `docs/prototipo/index.html` L845-903.
 */
export interface HomeHeroProps {
  indicators: HomeIndicators;
  verVagasHref?: string;
  publicarVagaHref?: string;
  searchAction?: string;
  jobs?: FeaturedJob[];
  className?: string;
}

export function HomeHero({
  indicators,
  verVagasHref = '/vagas',
  publicarVagaHref = '/cadastro',
  searchAction,
  jobs,
  className,
}: HomeHeroProps) {
  return (
    <section aria-label="Apresentação" className={cn('bg-background py-16 sm:py-24', className)}>
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <h1 className="font-heading text-4xl font-extrabold leading-tight text-fg sm:text-5xl">
            Conectando <span className="text-primary">talentos</span> a oportunidades na comunidade
          </h1>
          <p className="max-w-xl text-lg text-fg-muted">
            Portal de vagas da Paróquia Nossa Senhora de Guadalupe, Canasvieiras/SC. Uma iniciativa
            social que aproxima candidatos e empresas da região.
          </p>

          <div className="flex flex-wrap gap-4">
            <Button asChild variant="primary" size="lg">
              <Link href={verVagasHref}>Buscar Vagas</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href={publicarVagaHref}>Publicar Vaga</Link>
            </Button>
          </div>

          <HomeSearch action={searchAction} />

          <HomeIndicatorsView indicators={indicators} />
        </div>

        <div>
          <HomeFeaturedJobs jobs={jobs} />
        </div>
      </div>
    </section>
  );
}
