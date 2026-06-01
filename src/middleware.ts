import { NextResponse, type NextRequest } from 'next/server';
import { applySecurityHeaders } from '@/shared/lib/securityHeaders';
import { rateLimiter, RATE_LIMITS, type RateLimitCategory } from '@/shared/lib/rateLimit';

/**
 * Middleware do Next.js (Edge) — duas responsabilidades de hardening (US #200):
 *
 *  1. **Rate limiting** por categoria (technical-design §8 / issue #201):
 *     10 req/min anônimo, 60 req/min autenticado, 3 cadastros/15min por IP.
 *     Estouro → 429 com `Retry-After` e headers `X-RateLimit-*`.
 *  2. **Headers de segurança** (CSP, HSTS, X-Content-Type-Options,
 *     X-Frame-Options, Referrer-Policy, Permissions-Policy) em toda resposta.
 *
 * O gancho de revalidação de sessão por request (ADR-0030 — fecha a janela de
 * "sessão zumbi" após USP-007) será adicionado pela T-08 da USP-004; por ora a
 * presença/ausência do cookie de sessão Supabase é usada apenas para distinguir
 * a categoria de rate limit (anônimo x autenticado).
 *
 * **Edge Runtime:** o pino (Node) não roda aqui; eventos de limite atingido são
 * emitidos como JSON estruturado via `console.warn`, com o IP mascarado para não
 * vazar PII (LGPD / ADR-0009).
 */
export function middleware(request: NextRequest): NextResponse {
  const ip = clientIp(request);
  const category = resolveCategory(request);
  // Chave por categoria+IP; cadastro é sempre por IP (anti-spam de auto-cadastro).
  const key = `${category}:${ip}`;
  const result = rateLimiter.check(key, RATE_LIMITS[category]);

  // Poda amostrada (~1% das requisições): contém o crescimento do Map em memória
  // sem custo por request e sem depender de um gatilho externo/forjável.
  if (Math.random() < 0.01) rateLimiter.prune();

  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hsts = request.nextUrl.protocol === 'https:';

  if (!result.allowed) {
    logRateLimited(category, ip, request.nextUrl.pathname);
    const res = NextResponse.json(
      { ok: false, error: { code: 'RATE_LIMITED', message: 'Muitas requisições. Tente novamente em instantes.' } },
      { status: 429 },
    );
    res.headers.set('Retry-After', String(result.retryAfterSeconds));
    applyRateLimitHeaders(res.headers, result.limit, 0, result.resetAt);
    applySecurityHeaders(res.headers, { hsts, supabaseOrigin });
    return res;
  }

  const res = NextResponse.next();
  applyRateLimitHeaders(res.headers, result.limit, result.remaining, result.resetAt);
  applySecurityHeaders(res.headers, { hsts, supabaseOrigin });
  return res;
}

/**
 * Extrai o IP real do cliente. Prioriza os headers que a infraestrutura da
 * Vercel injeta a partir da conexão real (`x-vercel-forwarded-for`, `x-real-ip`)
 * — esses NÃO são forjáveis pelo cliente. O `x-forwarded-for` é spoofável (o
 * cliente pode enviar qualquer valor, e a Vercel apenas anexa o IP real à
 * direita), então só é usado como último recurso e tomando o valor mais à
 * direita (o appended pela borda), evitando que o atacante rode o bucket de
 * rate limit trocando o header.
 */
function clientIp(request: NextRequest): string {
  const vercel = request.headers.get('x-vercel-forwarded-for');
  if (vercel) return vercel.split(',')[0]!.trim();

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
    // Valor mais à direita = o anexado pela borda confiável; não o do cliente.
    return parts[parts.length - 1] ?? 'unknown';
  }
  return 'unknown';
}

/** Decide a categoria de rate limit a partir da rota e do cookie de sessão. */
function resolveCategory(request: NextRequest): RateLimitCategory {
  const path = request.nextUrl.pathname;
  if (path.startsWith('/cadastro') || path.startsWith('/cadastrar')) {
    return 'registration';
  }
  return isAuthenticated(request) ? 'authenticated' : 'anonymous';
}

/**
 * Heurística leve: a presença do cookie de sessão do Supabase (`sb-*-auth-token`)
 * indica usuário autenticado. A validação real do JWT fica para a T-08 (USP-004);
 * aqui basta separar a cota de rate limit.
 */
function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => /^sb-.*-auth-token/.test(c.name));
}

function applyRateLimitHeaders(target: Headers, limit: number, remaining: number, resetAt: number): void {
  target.set('X-RateLimit-Limit', String(limit));
  target.set('X-RateLimit-Remaining', String(remaining));
  target.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
}

/** Mascara o IP (mantém 2 primeiros octetos IPv4) para log sem PII. */
function maskIp(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  return ip === 'unknown' ? 'unknown' : 'masked';
}

function logRateLimited(category: RateLimitCategory, ip: string, path: string): void {
  // Estrutura alinhada ao shape do pino; sem PII (IP mascarado).
  console.warn(
    JSON.stringify({
      level: 'warn',
      event: 'rate_limit_exceeded',
      category,
      ip: maskIp(ip),
      path,
    }),
  );
}

/**
 * Aplica o middleware a rotas autenticadas e ao fluxo de auth.
 * Exclui arquivos estáticos, API internas e Next.js assets (não penaliza ISR).
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, manifest, robots, sitemap
     * - api (route handlers protegem-se por si)
     * - arquivos com extensão (favicon, fontes, imagens)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest|robots|sitemap|api|.*\\..*).+)',
  ],
};
