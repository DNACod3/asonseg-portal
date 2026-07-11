// Route group (public): conteúdo público com ISR + on-demand revalidation
// (revalidateTag/revalidatePath). ADR-0013 define a estratégia POR ROTA — o
// intervalo NÃO fica no layout do grupo (senão se propaga para todas as rotas):
//   • home `/`            → revalidate = 600  (10min, indicadores "tempo real")
//   • listagens/detalhe   → revalidate = 1800 (30min) + `force-static`
// Cada página declara o seu próprio `revalidate` — este layout não declara.

import { SiteFooter } from './_components/site-footer';
import { SiteHeader } from './_components/site-header';

/**
 * Casca de navegação global do grupo `(public)` (USP-046 T5, CASCA-12/13/14,
 * AD-025). Monta `SiteHeader`/`SiteFooter` uma única vez — envolvem todas as
 * rotas públicas. `<main>` é o único landmark `main` por página: as páginas
 * do grupo não devem mais declarar seu próprio `<main>` de topo (nota de
 * migração — design.md §7; corrigido nesta tarefa em `page.tsx`,
 * `vagas/page.tsx`, `vagas/[id]/page.tsx`, `servicos/page.tsx` e
 * `servicos/[id]/page.tsx`, que declaravam `<main>` próprio).
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
