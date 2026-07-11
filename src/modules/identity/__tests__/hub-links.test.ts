import { describe, it, expect } from 'vitest';
import {
  buildHubLinks,
  hubAccessFromRoles,
  EXISTING_HUB_ROUTES,
  type HubAccess,
} from '../domain/hub-links';

/**
 * USP-049 — HUB-02, HUB-03, HUB-05, HUB-MN-01, HUB-MN-02.
 *
 * `buildHubLinks`/`hubAccessFromRoles` são o núcleo puro do hub `/inicio`
 * (ORQ-1): garantem que todo link é uma rota real e alcançável pelo papel.
 */

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

function allHrefs(groups: ReturnType<typeof buildHubLinks>): string[] {
  return groups.flatMap((g) => g.links.map((l) => l.href));
}

describe('buildHubLinks — HUB-02 (hub nunca vazio)', () => {
  it('sempre inclui o grupo "Minha conta" com /perfil, /perfil/papeis, /consentimentos', () => {
    const groups = buildHubLinks(NO_ACCESS);
    const minhaConta = groups.find((g) => g.title === 'Minha conta');
    expect(minhaConta).toBeDefined();
    expect(minhaConta!.links.map((l) => l.href)).toEqual([
      '/perfil',
      '/perfil/papeis',
      '/consentimentos',
    ]);
  });

  it('Pessoa sem nenhum papel público/institucional ainda tem hub não-vazio', () => {
    const groups = buildHubLinks(NO_ACCESS);
    expect(allHrefs(groups).length).toBeGreaterThan(0);
  });
});

describe('buildHubLinks — HUB-03/05 (cada flag liga exatamente seu(s) link(s))', () => {
  it('candidate → /candidato', () => {
    const hrefs = allHrefs(buildHubLinks({ ...NO_ACCESS, candidate: true }));
    expect(hrefs).toContain('/candidato');
  });

  it('provider → /prestador, /prestador/servicos, /prestador/manifestacoes', () => {
    const hrefs = allHrefs(buildHubLinks({ ...NO_ACCESS, provider: true }));
    expect(hrefs).toEqual(
      expect.arrayContaining(['/prestador', '/prestador/servicos', '/prestador/manifestacoes']),
    );
  });

  it('companyResponsible → /empresa/cadastrar', () => {
    const hrefs = allHrefs(buildHubLinks({ ...NO_ACCESS, companyResponsible: true }));
    expect(hrefs).toContain('/empresa/cadastrar');
  });

  it('moderation → /moderacao', () => {
    const hrefs = allHrefs(buildHubLinks({ ...NO_ACCESS, moderation: true }));
    expect(hrefs).toContain('/moderacao');
  });

  it('reports → /relatorios', () => {
    const hrefs = allHrefs(buildHubLinks({ ...NO_ACCESS, reports: true }));
    expect(hrefs).toContain('/relatorios');
  });

  it('referral → /encaminhamentos/novo', () => {
    const hrefs = allHrefs(buildHubLinks({ ...NO_ACCESS, referral: true }));
    expect(hrefs).toContain('/encaminhamentos/novo');
  });

  it('assistedRegistration → /cadastro-assistido', () => {
    const hrefs = allHrefs(buildHubLinks({ ...NO_ACCESS, assistedRegistration: true }));
    expect(hrefs).toContain('/cadastro-assistido');
  });

  it('credentialClaim → /credenciais/reivindicacoes', () => {
    const hrefs = allHrefs(buildHubLinks({ ...NO_ACCESS, credentialClaim: true }));
    expect(hrefs).toContain('/credenciais/reivindicacoes');
  });

  it('permissions → /permissoes', () => {
    const hrefs = allHrefs(buildHubLinks({ ...NO_ACCESS, permissions: true }));
    expect(hrefs).toContain('/permissoes');
  });
});

describe('hubAccessFromRoles — HUB-03/05 (predicados por papel)', () => {
  it('CANDIDATE → candidate=true, demais falso', () => {
    const access = hubAccessFromRoles(['CANDIDATE']);
    expect(access.candidate).toBe(true);
    expect(access.provider).toBe(false);
    expect(access.companyResponsible).toBe(false);
    expect(access.reports).toBe(false);
    expect(access.referral).toBe(false);
    expect(access.assistedRegistration).toBe(false);
    expect(access.credentialClaim).toBe(false);
    expect(access.permissions).toBe(false);
  });

  it('PROVIDER → provider=true', () => {
    expect(hubAccessFromRoles(['PROVIDER']).provider).toBe(true);
  });

  it('COMPANY_RESPONSIBLE → companyResponsible=true', () => {
    expect(hubAccessFromRoles(['COMPANY_RESPONSIBLE']).companyResponsible).toBe(true);
  });

  it('COORDINATOR → reports, referral, credentialClaim, permissions = true; assistedRegistration=false', () => {
    const access = hubAccessFromRoles(['COORDINATOR']);
    expect(access.reports).toBe(true);
    expect(access.referral).toBe(true);
    expect(access.credentialClaim).toBe(true);
    expect(access.permissions).toBe(true);
    expect(access.assistedRegistration).toBe(false);
  });

  it('SOCIAL_ASSISTANT → reports, referral, assistedRegistration, credentialClaim = true; permissions=false', () => {
    const access = hubAccessFromRoles(['SOCIAL_ASSISTANT']);
    expect(access.reports).toBe(true);
    expect(access.referral).toBe(true);
    expect(access.assistedRegistration).toBe(true);
    expect(access.credentialClaim).toBe(true);
    expect(access.permissions).toBe(false);
  });

  it('BOARD → reports, assistedRegistration, credentialClaim = true; referral, permissions=false', () => {
    const access = hubAccessFromRoles(['BOARD']);
    expect(access.reports).toBe(true);
    expect(access.assistedRegistration).toBe(true);
    expect(access.credentialClaim).toBe(true);
    expect(access.referral).toBe(false);
    expect(access.permissions).toBe(false);
  });

  it('VOLUNTEER (sem delegação) → nenhum flag institucional true', () => {
    const access = hubAccessFromRoles(['VOLUNTEER']);
    expect(access.reports).toBe(false);
    expect(access.referral).toBe(false);
    expect(access.assistedRegistration).toBe(false);
    expect(access.credentialClaim).toBe(false);
    expect(access.permissions).toBe(false);
  });
});

describe('HUB-MN-01 — nenhum href fora da allowlist, para qualquer combinação de flags', () => {
  /** Gera todas as 2^9 combinações booleanas dos flags do HubAccess. */
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

  it('para todo subconjunto de flags, todo href ∈ EXISTING_HUB_ROUTES', () => {
    for (const access of allFlagCombinations()) {
      const hrefs = allHrefs(buildHubLinks(access));
      for (const href of hrefs) {
        expect(EXISTING_HUB_ROUTES).toContain(href);
      }
    }
  });

  it('nenhum href casa o prefixo de route group /app/', () => {
    for (const access of allFlagCombinations()) {
      const hrefs = allHrefs(buildHubLinks(access));
      for (const href of hrefs) {
        expect(/^\/app\//.test(href)).toBe(false);
      }
    }
  });

  it('nunca produz a rota-bare inexistente /empresa (só /empresa/cadastrar)', () => {
    for (const access of allFlagCombinations()) {
      const hrefs = allHrefs(buildHubLinks(access));
      expect(hrefs).not.toContain('/empresa');
    }
  });

  it('nunca produz a rota-bare inexistente /encaminhamentos (só /encaminhamentos/novo)', () => {
    for (const access of allFlagCombinations()) {
      const hrefs = allHrefs(buildHubLinks(access));
      expect(hrefs).not.toContain('/encaminhamentos');
    }
  });

  it('nunca produz /pessoas (fora de escopo desta USP)', () => {
    for (const access of allFlagCombinations()) {
      const hrefs = allHrefs(buildHubLinks(access));
      expect(hrefs).not.toContain('/pessoas');
    }
  });
});

describe('HUB-MN-02 — nenhum link de área sem permissão', () => {
  it('roles=[CANDIDATE] (moderation=false) ⇒ nenhum link institucional/moderação', () => {
    const access: HubAccess = { ...hubAccessFromRoles(['CANDIDATE']), moderation: false };
    const hrefs = allHrefs(buildHubLinks(access));
    expect(hrefs).not.toContain('/moderacao');
    expect(hrefs).not.toContain('/relatorios');
    expect(hrefs).not.toContain('/permissoes');
    expect(hrefs).not.toContain('/cadastro-assistido');
    expect(hrefs).not.toContain('/credenciais/reivindicacoes');
    expect(hrefs).not.toContain('/encaminhamentos/novo');
  });

  it('voluntário sem delegação (moderation=false) ⇒ sem /moderacao', () => {
    const access: HubAccess = { ...hubAccessFromRoles(['VOLUNTEER']), moderation: false };
    const hrefs = allHrefs(buildHubLinks(access));
    expect(hrefs).not.toContain('/moderacao');
  });
});
