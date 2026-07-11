import Link from 'next/link';
import { cn } from '@/shared/ui';

/**
 * Rodapé institucional da casca pública (USP-046, CASCA-08..11). Server
 * Component estático (A-08) — fiel à estrutura do protótipo
 * (`docs/prototipo/index.html` L2136-2178): marca + 4 colunas
 * (Candidatos/Empresas/Serviços/Institucional) + rodapé inferior com
 * copyright. Só classes de token (CASCA-MN-02); a superfície do footer é
 * sempre escura em ambos os temas via o token semântico `--color-footer`
 * (`globals.css`) — design.md §4 nota de fidelidade.
 *
 * Links só para rotas reais existentes (CASCA-09, G2). Itens do protótipo
 * sem rota pública real (institucionais, e os que dependem de sessão —
 * Cadastrar Empresa/Publicar Vaga/Buscar Candidatos/Oferecer Serviço, que
 * vivem sob `(app)/**` autenticado) viram texto não-focável "(em breve)"
 * (CASCA-10, A-07) — nunca um link sem destino. Os itens de wiring integrado
 * ("Sou Candidato/Sou Empresa" etc.) são USP-048 (DEF-3), não hard-coded
 * aqui.
 */

type FooterLinkItem = { label: string; href: string };
type FooterComingSoonItem = { label: string };
type FooterColumn = {
  heading: string;
  links: FooterLinkItem[];
  comingSoon?: FooterComingSoonItem[];
};

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: 'Candidatos',
    links: [
      { label: 'Buscar Vagas', href: '/vagas' },
      { label: 'Criar Perfil', href: '/cadastro' },
    ],
    comingSoon: [{ label: 'Dicas de Currículo' }, { label: 'FAQ' }],
  },
  {
    heading: 'Empresas',
    links: [],
    comingSoon: [
      { label: 'Cadastrar Empresa' },
      { label: 'Publicar Vaga' },
      { label: 'Buscar Candidatos' },
      { label: 'Planos' },
    ],
  },
  {
    heading: 'Serviços',
    links: [{ label: 'Buscar Serviços', href: '/servicos' }],
    comingSoon: [{ label: 'Oferecer Serviço' }, { label: 'Como Funciona' }],
  },
  {
    heading: 'Institucional',
    links: [],
    comingSoon: [
      { label: 'Sobre a ASONSEG' },
      { label: 'A Paróquia' },
      { label: 'Termos e Privacidade' },
      { label: 'Contato' },
    ],
  },
];

export interface SiteFooterProps {
  className?: string;
}

export function SiteFooter({ className }: SiteFooterProps) {
  return (
    <footer className={cn('bg-footer text-fg-muted', className)}>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 border-b border-border pb-8 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-gradient-to-br from-primary to-secondary font-heading text-lg font-black text-white"
              >
                A
              </span>
              <span className="font-heading text-xl font-extrabold text-white">ASONSEG</span>
            </div>
            <p className="text-sm leading-relaxed">
              Portal de Vagas da Ação Social da Paróquia Nossa Senhora de Guadalupe. Promovendo
              empregabilidade e inclusão social na comunidade de Canasvieiras, Florianópolis/SC.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h4 className="mb-4 font-heading text-xs font-bold uppercase tracking-wider text-white">
                {column.heading}
              </h4>
              <ul className="flex flex-col gap-1">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block py-1 text-sm transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                {column.comingSoon?.map((item) => (
                  <li key={item.label}>
                    <span className="block cursor-default select-none py-1 text-sm opacity-70">
                      {item.label} <span className="text-xs">(em breve)</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>
            &copy; 2026 ASONSEG — Ação Social Nsa. Sra. de Guadalupe. Todos os direitos reservados.
          </span>
          <span>Feito com cuidado para a comunidade de Canasvieiras/SC</span>
        </div>
      </div>
    </footer>
  );
}
