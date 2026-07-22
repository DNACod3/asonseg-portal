import { describe, it, expect } from 'vitest';
import { pickActiveHref, selectPrimaryTabs, BOTTOM_TAB_SHORT_LABELS } from '../domain/app-nav';
import { buildHubLinks, hubAccessFromRoles, EXISTING_HUB_ROUTES, type HubAccess } from '../domain/hub-links';

/**
 * USP-062/063 — BNAV-03 / DNAV-03 (compartilhado).
 *
 * `pickActiveHref` é o helper puro de active-state por longest-match,
 * substituindo o prefixo simples do `isActive` do `PublicNav` para rotas
 * aninhadas do hub (`/perfil` vs `/perfil/papeis`).
 */
describe('pickActiveHref — longest-match (BNAV-03/DNAV-03)', () => {
  it('match exato: pathname === href', () => {
    expect(pickActiveHref(['/perfil', '/candidato'], '/perfil')).toBe('/perfil');
  });

  it('match descendente: pathname é filho de um href da lista', () => {
    expect(pickActiveHref(['/candidato'], '/candidato/x')).toBe('/candidato');
  });

  it('raiz sem falso-match: /perfil não casa /perfilagem (sem separador "/")', () => {
    expect(pickActiveHref(['/perfil'], '/perfilagem')).toBeNull();
  });

  it('aninhado — longest-match: /perfil/papeis vence sobre /perfil quando ambos casam', () => {
    const result = pickActiveHref(['/perfil', '/perfil/papeis'], '/perfil/papeis');
    expect(result).toBe('/perfil/papeis');
  });

  it('aninhado — pathname descendente de /perfil/papeis ainda escolhe o candidato mais longo', () => {
    const result = pickActiveHref(['/perfil', '/perfil/papeis'], '/perfil/papeis/x');
    expect(result).toBe('/perfil/papeis');
  });

  it('no-match: pathname não corresponde a nenhum href → null', () => {
    expect(pickActiveHref(['/perfil', '/candidato'], '/relatorios')).toBeNull();
  });

  it('múltiplos candidatos não-aninhados: o mais longo entre eles vence', () => {
    const result = pickActiveHref(['/prestador', '/prestador/servicos'], '/prestador/servicos/1');
    expect(result).toBe('/prestador/servicos');
  });

  it('lista vazia de hrefs → null', () => {
    expect(pickActiveHref([], '/inicio')).toBeNull();
  });
});

const NO_ACCESS: HubAccess = {
  candidate: false,
  provider: false,
  companyResponsible: false,
  moderation: false,
  referral: false,
  assistedRegistration: false,
  credentialClaim: false,
  reports: false,
  permissions: false,
};

const FLAG_KEYS = Object.keys(NO_ACCESS) as (keyof HubAccess)[];

/** Gera todas as 2^9 combinações booleanas dos flags do HubAccess (molde: hub-links.test.ts). */
function allFlagCombinations(): HubAccess[] {
  const n = FLAG_KEYS.length;
  const combos: HubAccess[] = [];
  for (let mask = 0; mask < 2 ** n; mask++) {
    const access = { ...NO_ACCESS };
    FLAG_KEYS.forEach((key, i) => {
      access[key] = Boolean(mask & (1 << i));
    });
    combos.push(access);
  }
  return combos;
}

describe('selectPrimaryTabs — BNAV-01/02/06/07 (subconjunto primário determinístico)', () => {
  it('zero papéis → exatamente [Início, Perfil] (nunca vazia)', () => {
    const tabs = selectPrimaryTabs(buildHubLinks(NO_ACCESS));
    expect(tabs).toEqual([
      { href: '/inicio', label: 'Início' },
      { href: '/perfil', label: 'Perfil' },
    ]);
  });

  it('candidate=true → +1 aba "Meus papéis" (/candidato, rótulo "Candidato")', () => {
    const tabs = selectPrimaryTabs(buildHubLinks({ ...NO_ACCESS, candidate: true }));
    expect(tabs).toEqual([
      { href: '/inicio', label: 'Início' },
      { href: '/perfil', label: 'Perfil' },
      { href: '/candidato', label: 'Candidato' },
    ]);
  });

  it('moderation=true (institucional) → +1 aba primária institucional (/moderacao)', () => {
    const tabs = selectPrimaryTabs(buildHubLinks({ ...NO_ACCESS, moderation: true }));
    expect(tabs).toEqual([
      { href: '/inicio', label: 'Início' },
      { href: '/perfil', label: 'Perfil' },
      { href: '/moderacao', label: 'Moderação' },
    ]);
  });

  it('candidate + moderation (público + institucional) → 4 abas, nunca >5 (A2)', () => {
    const tabs = selectPrimaryTabs(buildHubLinks({ ...NO_ACCESS, candidate: true, moderation: true }));
    expect(tabs).toHaveLength(4);
    expect(tabs.map((t) => t.href)).toEqual(['/inicio', '/perfil', '/candidato', '/moderacao']);
  });

  it('provider=true → 1ª aba do grupo é o 1º link (/prestador), não os demais do grupo', () => {
    const tabs = selectPrimaryTabs(buildHubLinks({ ...NO_ACCESS, provider: true }));
    const hrefs = tabs.map((t) => t.href);
    expect(hrefs).toContain('/prestador');
    expect(hrefs).not.toContain('/prestador/servicos');
    expect(hrefs).not.toContain('/prestador/manifestacoes');
  });

  it('ordem determinística: mesma combinação produz sempre a mesma lista', () => {
    const access = { ...NO_ACCESS, candidate: true, reports: true };
    const first = selectPrimaryTabs(buildHubLinks(access));
    const second = selectPrimaryTabs(buildHubLinks(access));
    expect(second).toEqual(first);
  });

  it('BNAV-MN-01: para as 2^9 combinações de HubAccess, todo tab.href ∈ EXISTING_HUB_ROUTES ∪ {/inicio}', () => {
    const allowlist = new Set<string>([...EXISTING_HUB_ROUTES, '/inicio']);
    for (const access of allFlagCombinations()) {
      const tabs = selectPrimaryTabs(buildHubLinks(access));
      for (const tab of tabs) {
        expect(allowlist.has(tab.href)).toBe(true);
      }
    }
  });

  it('BNAV-MN-02: candidate-only (moderation=false) → sem aba institucional (/moderacao, /relatorios, etc.)', () => {
    const access: HubAccess = { ...hubAccessFromRoles(['CANDIDATE']), moderation: false };
    const hrefs = selectPrimaryTabs(buildHubLinks(access)).map((t) => t.href);
    expect(hrefs).not.toContain('/moderacao');
    expect(hrefs).not.toContain('/relatorios');
    expect(hrefs).not.toContain('/permissoes');
    expect(hrefs).not.toContain('/cadastro-assistido');
    expect(hrefs).not.toContain('/credenciais/reivindicacoes');
    expect(hrefs).not.toContain('/encaminhamentos/novo');
  });

  it('cobertura exaustiva: todo href de EXISTING_HUB_ROUTES ∪ {/inicio} tem rótulo curto não-vazio', () => {
    const allHrefs = ['/inicio', ...EXISTING_HUB_ROUTES];
    for (const href of allHrefs) {
      const label = BOTTOM_TAB_SHORT_LABELS[href];
      expect(label).toBeTruthy();
      expect(typeof label).toBe('string');
    }
  });
});
