/**
 * Navegação da casca `(app)` — helpers puros compartilhados pela bottom tab
 * bar (USP-062) e pelo menu desktop (USP-063).
 */

import type { HubLinkGroup } from './hub-links';

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

/** Uma aba da bottom tab bar (USP-062). */
export interface BottomTab {
  href: string;
  label: string;
}

/**
 * Rótulos curtos (PT-BR) para a bottom bar — mapa exaustivo cobrindo
 * `/inicio` + todos os `EXISTING_HUB_ROUTES` (ver `hub-links.ts`). Os rótulos
 * do hub são longos demais para uma aba ("Área do candidato" → "Candidato").
 */
export const BOTTOM_TAB_SHORT_LABELS: Record<string, string> = {
  '/inicio': 'Início',
  '/perfil': 'Perfil',
  '/perfil/papeis': 'Papéis',
  '/consentimentos': 'Consentimentos',
  '/candidato': 'Candidato',
  '/prestador': 'Prestador',
  '/prestador/servicos': 'Serviços',
  '/prestador/manifestacoes': 'Interesses',
  '/empresa/cadastrar': 'Empresa',
  '/moderacao': 'Moderação',
  '/relatorios': 'Relatórios',
  '/encaminhamentos/novo': 'Encaminhar',
  '/cadastro-assistido': 'Cadastro',
  '/credenciais/reivindicacoes': 'Credenciais',
  '/permissoes': 'Permissões',
};

/**
 * Reduz os grupos completos de `buildHubLinks` ao subconjunto **primário**
 * (≤5 abas) da bottom bar (BNAV-01/02/06/07): Início + Perfil fixos, mais o
 * primeiro link de cada grupo além de "Minha conta" (o próprio grupo
 * "Minha conta" já é coberto pela aba fixa "Perfil"/"Início").
 *
 * `groups` já vem role-filtrado por `buildHubLinks` — o role-awareness e a
 * allowlist (BNAV-MN-01/02) são herdados: nenhum grupo/link fora do que o
 * `HubAccess` concede aparece aqui.
 */
export function selectPrimaryTabs(groups: readonly HubLinkGroup[]): BottomTab[] {
  const tabs: BottomTab[] = [
    { href: '/inicio', label: 'Início' },
    { href: '/perfil', label: 'Perfil' },
  ];

  for (const group of groups) {
    if (group.title === 'Minha conta') continue;
    const firstLink = group.links[0];
    if (!firstLink) continue;
    tabs.push({
      href: firstLink.href,
      label: BOTTOM_TAB_SHORT_LABELS[firstLink.href] ?? firstLink.label,
    });
  }

  return tabs;
}
