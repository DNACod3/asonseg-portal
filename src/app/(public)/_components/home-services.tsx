import Link from 'next/link';
import type { ReactElement } from 'react';
import { Button, Card, StepIcon, cn } from '@/shared/ui';

/**
 * USP-047 (T5, HOME-08/HOME-13/HOME-14). Seção "Serviços": overline +
 * `<h2>` + 3 cards de categoria + CTA final, fiel ao protótipo
 * (`docs/prototipo/index.html` L983-1021). `servicosHref` é seam (default
 * `/servicos`) reaproveitada por cada card e pelo CTA.
 *
 * USP-048 (T2, NAV-03, seam A-09): `categories?` opcional — quando presente,
 * cada card usa seu próprio `href` (ex.: `/servicos?categoria=<id>`), em vez
 * do `servicosHref` genérico. Sem a prop, os 3 cards estáticos continuam
 * todos ligando a `servicosHref` (retrocompatível).
 */
export interface ServiceCategoryBase {
  variant: 'orange' | 'blue' | 'green';
  title: string;
  description: string;
  icon: ReactElement;
}

export interface ServiceCategoryCard extends ServiceCategoryBase {
  href: string;
}

const DOMESTICOS_ICON = (
  <svg
    aria-hidden="true"
    width="28"
    height="28"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205 3 1m1.5.5-1.5-.5M6.75 7.364V3h-3v18m3-13.636 10.5-3.819"
    />
  </svg>
);

const REPAROS_ICON = (
  <svg
    aria-hidden="true"
    width="28"
    height="28"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"
    />
  </svg>
);

const AREA_EXTERNA_ICON = (
  <svg
    aria-hidden="true"
    width="28"
    height="28"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12.75 3.03v.568c0 .334.148.65.405.864l1.068.89c.442.369.535 1.01.216 1.49l-.51.766a2.25 2.25 0 0 1-1.161.886l-.143.048a1.107 1.107 0 0 0-.57 1.664c.369.555.169 1.307-.427 1.605L9 13.125l.423 1.059a.956.956 0 0 1-1.652.928l-.679-.906a1.125 1.125 0 0 0-1.906.172L4.5 15.75l-.612.153M12.75 3.031a9 9 0 1 0 6.462 14.532M12.75 3.03a9 9 0 0 1 6.462 14.533m0 0 .535.143"
    />
  </svg>
);

/**
 * USP-048 (T4, NAV-03): exportado para que `page.tsx` componha os 3
 * `ServiceCategoryCard` reais (bucket + `href` resolvido via
 * `listServiceCategories()`) sem duplicar copy/ícones (fonte única).
 */
export const SERVICE_CATEGORIES: ServiceCategoryBase[] = [
  {
    variant: 'orange',
    title: 'Serviços Domésticos',
    description: 'Diaristas, faxineiras, passadeiras, cuidadores',
    icon: DOMESTICOS_ICON,
  },
  {
    variant: 'blue',
    title: 'Reparos e Manutenção',
    description: 'Eletricistas, encanadores, marido de aluguel, pintores',
    icon: REPAROS_ICON,
  },
  {
    variant: 'green',
    title: 'Área Externa',
    description: 'Jardineiros, paisagistas, limpeza de piscina',
    icon: AREA_EXTERNA_ICON,
  },
];

export interface HomeServicesProps {
  servicosHref?: string;
  categories?: ServiceCategoryCard[];
  className?: string;
}

export function HomeServices({ servicosHref = '/servicos', categories, className }: HomeServicesProps) {
  const cards: ServiceCategoryCard[] =
    categories ?? SERVICE_CATEGORIES.map((category) => ({ ...category, href: servicosHref }));

  return (
    <section aria-labelledby="home-services-heading" className={cn('py-16 sm:py-24', className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="font-heading text-sm font-bold uppercase tracking-wider text-fg-muted">
            Serviços
          </span>
          <h2 id="home-services-heading" className="mt-2 font-heading text-3xl font-extrabold text-fg">
            Precisa de um profissional?
          </h2>
          <p className="mt-3 text-fg-muted">
            Conectamos prestadores de serviços a pessoas que precisam de ajuda no dia a dia.
            Diaristas, eletricistas, jardineiros e muito mais.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {cards.map((category) => (
            <Link key={category.title} href={category.href} className="block">
              <Card className="text-center">
                <StepIcon variant={category.variant}>{category.icon}</StepIcon>
                <h3 className="font-heading text-lg font-bold text-fg">{category.title}</h3>
                <p className="mt-2 text-sm text-fg-muted">{category.description}</p>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button asChild variant="primary" size="lg">
            <Link href={servicosHref}>Ver Todos os Serviços</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
