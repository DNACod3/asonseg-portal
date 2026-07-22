/**
 * Navegação da casca `(app)` — helpers puros compartilhados pela bottom tab
 * bar (USP-062) e pelo menu desktop (USP-063).
 */

/**
 * Resolve qual `href` de um conjunto está "ativo" para o `pathname` atual,
 * por match exato-ou-descendente **mais longo** (BNAV-03/DNAV-03).
 *
 * Corrige o problema de prefixo simples do `isActive` do `PublicNav`: em
 * `/perfil/papeis`, tanto `/perfil` quanto `/perfil/papeis` casam, mas o
 * candidato de maior `length` vence — evitando que a raiz de um grupo
 * "engula" um descendente mais específico.
 *
 * Puro, sem IO/JSX — testável 1:1 e coverage-safe.
 */
export function pickActiveHref(hrefs: readonly string[], pathname: string): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (!matches) continue;
    if (best === null || href.length > best.length) {
      best = href;
    }
  }
  return best;
}
