import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/shared/env';
import { clientIp } from '@/shared/lib/clientIp';
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
 * Gate de sessão (USP-004 — T-08): rotas autenticadas conhecidas exigem a
 * presença do cookie de sessão Supabase; sem ele, redireciona a `/login`. Este
 * é o gate *barato* (sem rede/DB) do Edge. A revalidação autoritativa de
 * `Person.status` e o confinamento de 1º acesso por request (ADR-0030 / D-E,
 * D-F) ficam em `requireActivePerson()` (layout `(app)`, runtime Node) — o
 * Prisma não roda no Edge.
 *
 * **Edge Runtime:** o pino (Node) não roda aqui; eventos de limite atingido são
 * emitidos como JSON estruturado via `console.warn`, com o IP mascarado para não
 * vazar PII (LGPD / ADR-0009).
 */
export function middleware(request: NextRequest): NextResponse {
  const ip = clientIp(request.headers);
  const category = resolveCategory(request);
  // Chave por categoria+IP; cadastro é sempre por IP (anti-spam de auto-cadastro).
  const key = `${category}:${ip}`;
  const result = rateLimiter.check(key, RATE_LIMITS[category]);

  // Poda amostrada (~1% das requisições): contém o crescimento do Map em memória
  // sem custo por request e sem depender de um gatilho externo/forjável.
  if (Math.random() < 0.01) rateLimiter.prune();

  const supabaseOrigin = env.NEXT_PUBLIC_SUPABASE_URL;
  const hsts = request.nextUrl.protocol === 'https:';

  if (!result.allowed && !env.RATE_LIMIT_DISABLED) {
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

  // Gate de sessão (T-08): rota autenticada sem cookie de sessão → /login.
  if (isProtectedPath(request.nextUrl.pathname) && !isAuthenticated(request)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    const redirectRes = NextResponse.redirect(loginUrl);
    applyRateLimitHeaders(redirectRes.headers, result.limit, result.remaining, result.resetAt);
    applySecurityHeaders(redirectRes.headers, { hsts, supabaseOrigin });
    return redirectRes;
  }

  const res = NextResponse.next();
  applyRateLimitHeaders(res.headers, result.limit, result.remaining, result.resetAt);
  applySecurityHeaders(res.headers, { hsts, supabaseOrigin });
  return res;
}

/**
 * Prefixos de rota que exigem sessão. Route groups (`(app)`) não aparecem na
 * URL, então o gate de borda usa a lista de prefixos públicos das áreas
 * autenticadas. A checagem autoritativa (status/papéis) é do layout `(app)`.
 */
const PROTECTED_PREFIXES = [
  '/inicio',
  '/perfil',
  '/empresa',
  '/candidato',
  '/moderacao',
  '/encaminhamentos',
  '/admin',
] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
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
    // Literal de string (não `String.raw`): o build do Next exige um nó
    // estático e analisável no `config.matcher` (não um TaggedTemplateExpression).
    '/((?!_next/static|_next/image|favicon.ico|manifest|robots|sitemap|api|.*\\..*).+)',
  ],
};
