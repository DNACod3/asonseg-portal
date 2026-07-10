import type { ReactElement } from 'react';
import { Card, StepIcon } from '@/shared/ui';

/**
 * USP-047 (T3, HOME-06/HOME-13). Seção "Como Funciona": overline + `<h2>` +
 * subtítulo + 3 passos, fiel ao protótipo (`docs/prototipo/index.html`
 * L906-938). Server Component estático, sem seams (conteúdo institucional
 * fixo).
 */
interface Step {
  number: string;
  variant: 'blue' | 'orange' | 'green';
  title: string;
  description: string;
  icon: ReactElement;
}

const CHECK_ICON = (
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
      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
    />
  </svg>
);

const SEARCH_ICON = (
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
      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
    />
  </svg>
);

const CONNECT_ICON = (
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
      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </svg>
);

const STEPS: Step[] = [
  {
    number: 'PASSO 01',
    variant: 'blue',
    title: 'Crie seu perfil',
    description:
      'Cadastre-se como candidato ou empresa. Adicione suas qualificações, experiências ou publique suas vagas.',
    icon: CHECK_ICON,
  },
  {
    number: 'PASSO 02',
    variant: 'orange',
    title: 'Busque e filtre',
    description:
      'Encontre vagas por área, tipo de contrato ou localização. Empresas podem buscar candidatos por qualificação.',
    icon: SEARCH_ICON,
  },
  {
    number: 'PASSO 03',
    variant: 'green',
    title: 'Conecte-se',
    description:
      'Candidate-se diretamente pelo portal ou entre em contato com os candidatos ideais para sua empresa.',
    icon: CONNECT_ICON,
  },
];

export function HomeHowItWorks() {
  return (
    <section aria-labelledby="home-how-it-works-heading" className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="font-heading text-sm font-bold uppercase tracking-wider text-fg-muted">
            Como Funciona
          </span>
          <h2 id="home-how-it-works-heading" className="mt-2 font-heading text-3xl font-extrabold text-fg">
            Simples, rápido e gratuito
          </h2>
          <p className="mt-3 text-fg-muted">
            Nossa plataforma conecta você às melhores oportunidades da região de Canasvieiras em
            poucos passos.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <Card key={step.number} className="text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-fg-muted">
                {step.number}
              </span>
              <StepIcon variant={step.variant}>{step.icon}</StepIcon>
              <h3 className="font-heading text-lg font-bold text-fg">{step.title}</h3>
              <p className="mt-2 text-sm text-fg-muted">{step.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
