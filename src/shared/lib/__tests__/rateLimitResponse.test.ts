import { describe, it, expect } from 'vitest';
import { isRouterDataRequest, isDocumentRequest, renderRateLimitedHtml } from '@/shared/lib/rateLimitResponse';

/**
 * USP-050 (PUB-1b/PUB-1c) — sinais de fetch do client router/documento e
 * página 429 PT-BR.
 *
 * Ciclo de fix pós-Verifier: o header `Next-Router-Prefetch` (e `rsc`, e o
 * query param `_rsc`) NUNCA chegam a `request.headers`/`request.nextUrl` no
 * servidor real (Next 15.5.18) — confirmado empiricamente com curl -v +
 * instrumentação temporária (revertida) + um browser Chromium real via
 * Playwright. O sinal que sobrevive é `Next-Url` (setado pelo client router
 * em toda fetch de dados RSC — prefetch E navegação client-side real, pois
 * nenhum sinal as diferencia no middleware desta versão). `isPrefetchRequest`
 * foi renomeado para `isRouterDataRequest` para refletir o escopo real.
 */
describe('isRouterDataRequest', () => {
  it('Next-Url presente → true (fetch de dados do client router — prefetch OU navegação real)', () => {
    expect(isRouterDataRequest(new Headers({ 'next-url': '/' }))).toBe(true);
  });

  it('header ausente → false', () => {
    expect(isRouterDataRequest(new Headers())).toBe(false);
  });

  it('fallback: Purpose: prefetch → true', () => {
    expect(isRouterDataRequest(new Headers({ purpose: 'prefetch' }))).toBe(true);
  });

  it('REGRESSÃO (achado do Verifier): Next-Router-Prefetch sozinho (sem Next-Url) NÃO é mais um sinal válido — nunca chega ao servidor real', () => {
    expect(isRouterDataRequest(new Headers({ 'next-router-prefetch': '1' }))).toBe(false);
  });

  it('RSC sozinho (sem Next-Url) também não é sinal — mesma raiz do achado do Verifier', () => {
    expect(isRouterDataRequest(new Headers({ rsc: '1' }))).toBe(false);
  });
});

describe('isDocumentRequest', () => {
  it('Accept com text/html → true (navegação de documento real)', () => {
    expect(isDocumentRequest(new Headers({ accept: 'text/html,application/xhtml+xml' }))).toBe(true);
  });

  it('Accept com text/html continua true mesmo com Next-Url presente (rsc dead-code removido; Next-Url nunca ocorre com Accept:text/html na prática, mas Accept sozinho já discrimina)', () => {
    expect(
      isDocumentRequest(new Headers({ accept: 'text/html,application/xhtml+xml', 'next-url': '/' })),
    ).toBe(true);
  });

  it('Accept sem text/html (RSC/fetch/Server Action real: */* ou text/x-component) → false', () => {
    expect(isDocumentRequest(new Headers({ accept: '*/*' }))).toBe(false);
    expect(isDocumentRequest(new Headers({ accept: 'text/x-component' }))).toBe(false);
  });

  it('sem header Accept → false (falha segura, cai em JSON)', () => {
    expect(isDocumentRequest(new Headers())).toBe(false);
  });
});

describe('renderRateLimitedHtml', () => {
  const html = renderRateLimitedHtml(30);

  it('é HTML com lang="pt-BR"', () => {
    expect(html).toContain('<html lang="pt-BR">');
  });

  it('contém título/mensagem PT-BR de "muitas requisições"', () => {
    expect(html.toLowerCase()).toContain('muitas requisições');
  });

  it('referencia o tempo de espera (segundos)', () => {
    expect(html).toContain('30 segundos');
  });

  it('não contém origem externa (http/https), CDN ou imagem remota', () => {
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<img\s/);
  });

  it('arredonda e aplica piso de 1 segundo para valores fracionários/zero', () => {
    expect(renderRateLimitedHtml(0.4)).toContain('1 segundos');
    expect(renderRateLimitedHtml(2.6)).toContain('3 segundos');
  });
});
