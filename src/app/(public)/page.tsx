import { searchJobs, type JobListItem } from '@/modules/jobs';
import { getHomeIndicators, type HomeIndicators } from '@/modules/reporting';
import { listServiceCategories, type ServiceCategoryOption } from '@/modules/services';
import { childLogger } from '@/shared/lib/logger';
import { HomeCta } from './_components/home-cta';
import type { FeaturedJob } from './_components/home-featured-jobs';
import { HomeHero } from './_components/home-hero';
import { HomeHowItWorks } from './_components/home-how-it-works';
import { HomePersonas } from './_components/home-personas';
import { HomeServices, SERVICE_CATEGORIES, type ServiceCategoryCard } from './_components/home-services';

/**
 * USP-048 (T4, NAV-03): rota real de fallback quando nenhuma categoria da
 * taxonomia casa com o bucket do protótipo, ou quando `listServiceCategories`
 * falha/retorna vazio — nunca um id inventado, nunca um link sem destino.
 */
const SERVICOS_HREF = '/servicos';

/**
 * USP-048 (T4, NAV-03, design §5). Palavra-chave por bucket do protótipo,
 * casada contra o nome normalizado (lowercase + sem acento) da categoria
 * real. Resolve a fragilidade do match nome→id no design (L-002/L-005): sem
 * match, o bucket cai para `SERVICOS_HREF` (contrato determinístico).
 */
const BUCKET_KEYWORD_BY_TITLE: Record<string, RegExp> = {
  'Serviços Domésticos': /domestic/,
  'Reparos e Manutenção': /repar|manuten/,
  'Área Externa': /extern|jardin/,
};

function normalizeCategoryName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Helper puro testável (design §5): resolve o `href` de um bucket do
 * protótipo contra as categorias reais. Sem palavra-chave conhecida, sem
 * categorias, ou sem match → `SERVICOS_HREF` (fallback garantido).
 */
function resolveCategoryHref(bucketTitle: string, categories: ServiceCategoryOption[]): string {
  const keyword = BUCKET_KEYWORD_BY_TITLE[bucketTitle];
  if (!keyword) return SERVICOS_HREF;
  const match = categories.find((category) => keyword.test(normalizeCategoryName(category.name)));
  return match ? `${SERVICOS_HREF}?categoria=${match.id}` : SERVICOS_HREF;
}

function buildServiceCategoryCards(categories: ServiceCategoryOption[]): ServiceCategoryCard[] {
  return SERVICE_CATEGORIES.map((base) => ({
    ...base,
    href: resolveCategoryHref(base.title, categories),
  }));
}

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

/**
 * USP-048 (T3, NAV-02/NAV-MN-01). Mapeia um `JobListItem` (View Model já
 * anonimizado por `searchJobs(..., null)`) para o seam apresentacional
 * `FeaturedJob` — só copia campos do View Model, nunca `nomeFantasia`/PII
 * (o próprio View Model não a carrega para o anônimo, `jobListSelect(false)`).
 */
function toFeaturedJob(item: JobListItem): FeaturedJob {
  return {
    title: item.title,
    company: item.company.displayName,
    tags: [item.area, item.contractType].filter((v): v is string => Boolean(v)),
    href: `/vagas/${item.id}`,
  };
}

/**
 * USP-048 (T3, NAV-02/NAV-MN-01). Top-2 vagas ACTIVE reais (anonimizadas,
 * `viewer=null`) para o destaque do hero. Mesmo padrão try/catch → fallback
 * de `loadIndicators` (ADR-0026): erro ou lista vazia retornam `undefined`
 * (não `[]`) para que `HomeFeaturedJobs` caia no próprio `DEFAULT_JOBS` via
 * o default de parâmetro (que só ativa em `undefined`, nunca em array vazio).
 */
async function loadFeaturedJobs(): Promise<FeaturedJob[] | undefined> {
  try {
    const result = await searchJobs({ page: 1 }, null);
    const mapped = result.items.slice(0, 2).map(toFeaturedJob);
    return mapped.length > 0 ? mapped : undefined;
  } catch (err) {
    log.error({ err }, 'jobs:home-featured-jobs:load-failed');
    return undefined;
  }
}

/**
 * USP-048 (T4, NAV-03). Resolve os 3 cards de categoria contra a taxonomia
 * real; erro/lista vazia caem para `buildServiceCategoryCards([])`, que
 * resolve todos os 3 buckets para `SERVICOS_HREF` (mesmo padrão try/catch de
 * `loadIndicators`, ADR-0026).
 */
async function loadServiceCategoryHrefs(): Promise<ServiceCategoryCard[]> {
  try {
    const categories = await listServiceCategories();
    return buildServiceCategoryCards(categories);
  } catch (err) {
    log.error({ err }, 'services:home-service-categories:load-failed');
    return buildServiceCategoryCards([]);
  }
}

/**
 * USP-047 (T8, HOME-10/11/12/13/MN-03/MN-04): landing pública fiel à
 * `#page-home` do protótipo. Compõe as 5 seções na ordem hero → Como
 * Funciona → Para Quem → Serviços → CTA final; **não** re-declara `<main>`
 * (vem do `(public)/layout.tsx`, USP-046/CASCA-12) — um único landmark
 * `main` por página. Os indicadores da USP-041 seguem carregados aqui e
 * passados por prop ao `HomeHero`, que os embute via `HomeIndicatorsView`
 * inalterado (HOME-05/HOME-MN-03).
 *
 * USP-048 (T3, NAV-02): o destaque de vagas do hero agora recebe as top-2
 * vagas ACTIVE reais anonimizadas (`loadFeaturedJobs`), com fallback ao mock
 * estático em vazio/erro.
 *
 * USP-048 (T4, NAV-03/NAV-04): as categorias de `HomeServices` agora linkam
 * ao filtro real (`loadServiceCategoryHrefs`); os CTAs de **empresa**
 * (hero/personas/CTA final) reapontam para a rota real de cadastro de
 * empresa `/empresa/cadastrar` (que redireciona o anônimo a `/login` pelo
 * guard de sessão da rota, comportamento existente — A-07); os CTAs de
 * **candidato** permanecem `/cadastro`.
 */
export default async function HomePage() {
  const [indicators, jobs, serviceCategories] = await Promise.all([
    loadIndicators(),
    loadFeaturedJobs(),
    loadServiceCategoryHrefs(),
  ]);

  return (
    <>
      <HomeHero indicators={indicators} jobs={jobs} publicarVagaHref="/empresa/cadastrar" />
      <HomeHowItWorks />
      <HomePersonas empresaHref="/empresa/cadastrar" candidatoHref="/cadastro" />
      <HomeServices categories={serviceCategories} />
      <HomeCta empresaHref="/empresa/cadastrar" candidatoHref="/cadastro" />
    </>
  );
}
