import Link from 'next/link';
import { Button, Card, StepIcon, cn } from '@/shared/ui';

/**
 * USP-047 (T4, HOME-07/HOME-13/HOME-14). Seção "Para Quem": overline +
 * `<h2>` + 2 cards de persona (Candidato/Empresa), fiel ao protótipo
 * (`docs/prototipo/index.html` L943-980). `candidatoHref`/`empresaHref` são
 * seams (default `/cadastro`, A-05) para a USP-048 retargetar ao fluxo
 * diferenciado sem reescrever o componente.
 */
const CHECK_ICON = (
  <svg
    aria-hidden="true"
    className="mt-0.5 h-4 w-4 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2.5"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </svg>
);

const CANDIDATO_ICON = (
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

const EMPRESA_ICON = (
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
      d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
    />
  </svg>
);

export interface HomePersonasProps {
  candidatoHref?: string;
  empresaHref?: string;
  className?: string;
}

export function HomePersonas({
  candidatoHref = '/cadastro',
  empresaHref = '/cadastro',
  className,
}: HomePersonasProps) {
  return (
    <section aria-labelledby="home-personas-heading" className={cn('bg-surface py-16 sm:py-24', className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="font-heading text-sm font-bold uppercase tracking-wider text-fg-muted">
            Para Quem
          </span>
          <h2 id="home-personas-heading" className="mt-2 font-heading text-3xl font-extrabold text-fg">
            Uma plataforma, duas perspectivas
          </h2>
          <p className="mt-3 text-fg-muted">
            Seja você candidato buscando uma oportunidade ou empresa procurando talentos, temos
            ferramentas para você.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Card className="flex flex-col">
            <StepIcon variant="blue" className="mb-4">
              {CANDIDATO_ICON}
            </StepIcon>
            <h3 className="font-heading text-xl font-bold text-fg">Sou Candidato</h3>
            <p className="mt-2 text-fg-muted">
              Encontre vagas compatíveis com seu perfil e candidate-se diretamente pela plataforma.
            </p>
            <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm text-fg">
              <li className="flex items-start gap-2 text-primary">
                {CHECK_ICON}
                <span className="text-fg">Busque vagas com filtros avançados</span>
              </li>
              <li className="flex items-start gap-2 text-primary">
                {CHECK_ICON}
                <span className="text-fg">Cadastre suas qualificações e experiências</span>
              </li>
              <li className="flex items-start gap-2 text-primary">
                {CHECK_ICON}
                <span className="text-fg">Envie seu currículo (PDF)</span>
              </li>
              <li className="flex items-start gap-2 text-primary">
                {CHECK_ICON}
                <span className="text-fg">Receba notificações de vagas compatíveis</span>
              </li>
            </ul>
            <Button asChild variant="primary" className="mt-6 self-start">
              <Link href={candidatoHref}>Criar Meu Perfil</Link>
            </Button>
          </Card>

          <Card className="flex flex-col">
            <StepIcon variant="orange" className="mb-4">
              {EMPRESA_ICON}
            </StepIcon>
            <h3 className="font-heading text-xl font-bold text-fg">Sou Empresa</h3>
            <p className="mt-2 text-fg-muted">
              Publique vagas e encontre os melhores candidatos da região para sua empresa.
            </p>
            <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm text-fg">
              <li className="flex items-start gap-2 text-cta">
                {CHECK_ICON}
                <span className="text-fg">Publique vagas com requisitos e benefícios</span>
              </li>
              <li className="flex items-start gap-2 text-cta">
                {CHECK_ICON}
                <span className="text-fg">Busque candidatos por qualificação</span>
              </li>
              <li className="flex items-start gap-2 text-cta">
                {CHECK_ICON}
                <span className="text-fg">Acesse currículos dos candidatos</span>
              </li>
              <li className="flex items-start gap-2 text-cta">
                {CHECK_ICON}
                <span className="text-fg">Gerencie suas vagas publicadas</span>
              </li>
            </ul>
            <Button asChild variant="primary" className="mt-6 self-start">
              <Link href={empresaHref}>Cadastrar Empresa</Link>
            </Button>
          </Card>
        </div>
      </div>
    </section>
  );
}
