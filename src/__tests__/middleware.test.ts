import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { rateLimiter } from '@/shared/lib/rateLimit';

/**
 * Testes do Edge Middleware (US #200 / #201): categorização anônimo/autenticado/
 * cadastro, extração de IP confiável, caminho 429 e presença dos headers de
 * segurança em toda resposta. O núcleo (janela deslizante, CSP) é testado nas
 * libs; aqui validamos o glue.
 */

function req(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://portal.asonseg.org.br${path}`, { headers });
}

/** Cookie de sessão Supabase usado para simular usuário autenticado. */
const AUTH_COOKIE = { Cookie: 'sb-portal-auth-token=abc123' };

beforeEach(() => {
  rateLimiter.reset();
  // Estabiliza a poda amostrada (Math.random) para não interferir nos testes.
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

describe('middleware — headers de segurança', () => {
  it('aplica os headers de segurança em respostas permitidas', () => {
    const res = middleware(req('/vagas', { 'x-real-ip': '1.2.3.4' }));
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy();
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    // HTTPS → HSTS presente.
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=');
  });

  it('inclui headers X-RateLimit-* na resposta permitida', () => {
    const res = middleware(req('/vagas', { 'x-real-ip': '1.2.3.4' }));
    expect(res.headers.get('X-RateLimit-Limit')).toBe('10'); // anônimo
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('9');
  });
});

describe('middleware — categorização e rate limit', () => {
  it('trata request anônima com limite de 10/min', () => {
    let last;
    for (let i = 0; i < 10; i++) {
      last = middleware(req('/vagas', { 'x-real-ip': '9.9.9.9' }));
      expect(last.status).not.toBe(429);
    }
    const blocked = middleware(req('/vagas', { 'x-real-ip': '9.9.9.9' }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
    // Headers de segurança presentes mesmo no 429.
    expect(blocked.headers.get('Content-Security-Policy')).toBeTruthy();
  });

  it('usa o limite de autenticado (60/min) quando há cookie de sessão', () => {
    const res = middleware(req('/perfil', { 'x-real-ip': '1.1.1.1', ...AUTH_COOKIE }));
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60');
  });

  it('usa o limite de cadastro (3/15min) na rota /cadastro', () => {
    const ip = { 'x-real-ip': '2.2.2.2' };
    expect(middleware(req('/cadastro', ip)).headers.get('X-RateLimit-Limit')).toBe('3');
    middleware(req('/cadastro', ip));
    middleware(req('/cadastro', ip));
    const fourth = middleware(req('/cadastro', ip));
    expect(fourth.status).toBe(429);
  });
});

describe('middleware — extração de IP confiável (anti-spoof)', () => {
  it('prioriza x-vercel-forwarded-for sobre x-forwarded-for forjado', () => {
    // Mesmo IP real (via header confiável), x-forwarded-for variando → mesmo bucket.
    for (let i = 0; i < 10; i++) {
      middleware(
        req('/vagas', {
          'x-vercel-forwarded-for': '5.5.5.5',
          'x-forwarded-for': `${i}.${i}.${i}.${i}`, // tentativa de spoof
        }),
      );
    }
    const blocked = middleware(
      req('/vagas', { 'x-vercel-forwarded-for': '5.5.5.5', 'x-forwarded-for': '123.0.0.1' }),
    );
    expect(blocked.status).toBe(429);
  });

  it('quando só há x-forwarded-for, usa o valor mais à direita (anexado pela borda)', () => {
    // Cliente injeta IPs à esquerda; a borda confiável anexa o real à direita.
    for (let i = 0; i < 10; i++) {
      middleware(req('/vagas', { 'x-forwarded-for': `${i}.0.0.0, 7.7.7.7` }));
    }
    const blocked = middleware(req('/vagas', { 'x-forwarded-for': '250.0.0.0, 7.7.7.7' }));
    expect(blocked.status).toBe(429);
  });
});

describe('middleware — gate de sessão (USP-004, T-08)', () => {
  // Prefixos protegidos (sem aparecer o route group `(app)` na URL).
  const PROTECTED = ['/inicio', '/perfil', '/empresa', '/candidato', '/moderacao', '/encaminhamentos', '/admin'];

  it.each(PROTECTED)('rota protegida %s sem cookie de sessão → redirect /login', (path) => {
    const res = middleware(req(path, { 'x-real-ip': '4.4.4.4' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://portal.asonseg.org.br/login');
    // Headers de segurança presentes mesmo no redirect.
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy();
  });

  it('rota protegida em subcaminho (/perfil/editar) sem cookie → redirect /login', () => {
    const res = middleware(req('/perfil/editar', { 'x-real-ip': '4.4.4.5' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://portal.asonseg.org.br/login');
  });

  it('rota protegida COM cookie de sessão → não redireciona (segue para revalidação no layout)', () => {
    const res = middleware(req('/inicio', { 'x-real-ip': '4.4.4.6', ...AUTH_COOKIE }));
    expect(res.status).not.toBe(307);
    expect(res.headers.get('location')).toBeNull();
  });

  it('rota pública (/vagas) sem cookie → não redireciona', () => {
    const res = middleware(req('/vagas', { 'x-real-ip': '4.4.4.7' }));
    expect(res.status).not.toBe(307);
  });

  it('não confunde prefixo (/inicior não é protegido)', () => {
    const res = middleware(req('/inicior', { 'x-real-ip': '4.4.4.8' }));
    expect(res.status).not.toBe(307);
  });
});
