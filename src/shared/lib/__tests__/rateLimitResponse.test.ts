import { describe, it, expect } from 'vitest';
import { isPrefetchRequest, isDocumentRequest, renderRateLimitedHtml } from '@/shared/lib/rateLimitResponse';

/**
 * USP-050 (PUB-1b/PUB-1c) — sinais de prefetch/documento e página 429 PT-BR.
 */
describe('isPrefetchRequest', () => {
  it('Next-Router-Prefetch: 1 → true', () => {
    expect(isPrefetchRequest(new Headers({ 'next-router-prefetch': '1' }))).toBe(true);
  });

  it('header ausente → false', () => {
    expect(isPrefetchRequest(new Headers())).toBe(false);
  });

  it('fallback: Purpose: prefetch → true', () => {
    expect(isPrefetchRequest(new Headers({ purpose: 'prefetch' }))).toBe(true);
  });

  it('Next-Router-Prefetch com valor diferente de "1" → false', () => {
    expect(isPrefetchRequest(new Headers({ 'next-router-prefetch': '0' }))).toBe(false);
  });
});

describe('isDocumentRequest', () => {
  it('Accept com text/html e sem rsc → true', () => {
    expect(isDocumentRequest(new Headers({ accept: 'text/html,application/xhtml+xml' }))).toBe(true);
  });

  it('Accept com text/html mas rsc:1 → false (RSC vence)', () => {
    expect(
      isDocumentRequest(new Headers({ accept: 'text/html,application/xhtml+xml', rsc: '1' })),
    ).toBe(false);
  });

  it('Accept sem text/html (RSC/fetch) → false', () => {
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
