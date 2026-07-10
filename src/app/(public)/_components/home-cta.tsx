import Link from 'next/link';
import { Button, cn } from '@/shared/ui';

/**
 * USP-047 (T6, HOME-09/HOME-13/HOME-14). Faixa de CTA final: `<h2>` +
 * subtítulo + 2 CTAs sobre um fundo em gradiente de token, fiel ao
 * protótipo (`docs/prototipo/index.html` L1023-1033). `candidatoHref`/
 * `empresaHref` são seams (default `/cadastro`, A-05). `text-white`/
 * `bg-white` são utilitários (não hex/paleta numérica, A-08) — mesmo
 * precedente aprovado em `site-header.tsx`/`site-footer.tsx`.
 */
export interface HomeCtaProps {
  candidatoHref?: string;
  empresaHref?: string;
  className?: string;
}

export function HomeCta({
  candidatoHref = '/cadastro',
  empresaHref = '/cadastro',
  className,
}: HomeCtaProps) {
  return (
    <section
      aria-labelledby="home-cta-heading"
      className={cn(
        'bg-gradient-to-br from-primary to-secondary py-16 text-center text-white sm:py-24',
        className,
      )}
    >
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <h2 id="home-cta-heading" className="font-heading text-3xl font-extrabold text-white">
          Faça parte dessa iniciativa social
        </h2>
        <p className="mt-3 text-white/85">
          Uma ação da Paróquia Nossa Senhora de Guadalupe, promovendo empregabilidade e
          desenvolvimento na comunidade de Canasvieiras.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button asChild size="lg" className="bg-white font-bold text-primary hover:bg-white/90">
            <Link href={candidatoHref}>Cadastrar como Candidato</Link>
          </Button>
          <Button
            asChild
            size="lg"
            className="border-2 border-white/40 bg-white/15 text-white hover:bg-white/25"
          >
            <Link href={empresaHref}>Cadastrar como Empresa</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
