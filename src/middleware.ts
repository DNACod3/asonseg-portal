import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/shared/env';
import { clientIp } from '@/shared/lib/clientIp';
import { applySecurityHeaders } from '@/shared/lib/securityHeaders';
import { rateLimiter, RATE_LIMITS, type RateLimitCategory, type RateLimitResult } from '@/shared/lib/rateLimit';
import { isRouterDataRequest, isDocumentRequest, renderRateLimitedHtml } from '@/shared/lib/rateLimitResponse';

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
  const supabaseOrigin = env.NEXT_PUBLIC_SUPABASE_URL;
  const hsts = request.nextUrl.protocol === 'https:';

  // H2 (Fase 6 — hardening): rotas /api ganham SÓ headers de segurança — sem
  // rate-limit, sem gate de sessão. Crons (`/api/cron/*`) autenticam por
  // CRON_SECRET; rate-limitar/redirecionar quebraria o Vercel Cron. Branch
  // único, antes de qualquer outra lógica, garante que /api nunca entra no
  // bucket nem no redirect de sessão.
  if (request.nextUrl.pathname.startsWith('/api')) {
    const res = NextResponse.next();
    applySecurityHeaders(res.headers, { hsts, supabaseOrigin });
    return res;
  }

  const ip = clientIp(request.headers);

  // Fetch de dados do client router (USP-050 · PUB-1b — corrigido no ciclo de
  // fix pós-Verifier): cobre prefetch E navegação client-side real do <Link>
  // (`Next-Router-Prefetch`/`RSC`/`_rsc` nunca chegam a request.headers/
  // nextUrl neste servidor — confirmado empiricamente; o sinal que sobrevive é
  // `Next-Url`, ver rateLimitResponse.ts). Como as duas são indistinguíveis
  // aqui, nenhuma delas conta nem bloqueia bucket — segue direto para o gate
  // de sessão + security headers, sem headers X-RateLimit-* (RL-MN-01). Gate
  // explícito a GET/HEAD: uma mutação (Server Action é sempre POST, e não
  // carrega `Next-Url` — confirmado empiricamente) nunca é isenta por aqui.
  const isRouterFetch =
    (request.method === 'GET' || request.method === 'HEAD') && isRouterDataRequest(request.headers);
  let result: RateLimitResult | null = null;

  if (!isRouterFetch) {
    const category = resolveCategory(request);
    // Chave por categoria+IP; cadastro é sempre por IP (anti-spam de auto-cadastro).
    const key = `${category}:${ip}`;
    result = rateLimiter.check(key, RATE_LIMITS[category]);

    // Poda amostrada (~1% das requisições): contém o crescimento do Map em memória
    // sem custo por request e sem depender de um gatilho externo/forjável.
    if (Math.random() < 0.01) rateLimiter.prune();

    if (!result.allowed && !env.RATE_LIMIT_DISABLED) {
      logRateLimited(category, ip, request.nextUrl.pathname);
      // 429 de navegação de documento → HTML PT-BR (USP-050 · PUB-1c); RSC/
      // fetch/Server Action continuam recebendo o JSON atual, inalterado
      // (RL-MN-06).
      const res = isDocumentRequest(request.headers)
        ? new NextResponse(renderRateLimitedHtml(result.retryAfterSeconds), {
            status: 429,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        : NextResponse.json(
            { ok: false, error: { code: 'RATE_LIMITED', message: 'Muitas requisições. Tente novamente em instantes.' } },
            { status: 429 },
          );
      res.headers.set('Retry-After', String(result.retryAfterSeconds));
      res.headers.set('Cache-Control', 'no-store');
      applyRateLimitHeaders(res.headers, result.limit, 0, result.resetAt);
      applySecurityHeaders(res.headers, { hsts, supabaseOrigin });
      return res;
    }
  }

  // Gate de sessão (T-08): rota autenticada sem cookie de sessão → /login.
  if (isProtectedPath(request.nextUrl.pathname) && !isAuthenticated(request)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    const redirectRes = NextResponse.redirect(loginUrl);
    if (result !== null) applyRateLimitHeaders(redirectRes.headers, result.limit, result.remaining, result.resetAt);
    applySecurityHeaders(redirectRes.headers, { hsts, supabaseOrigin });
    return redirectRes;
  }

  const res = NextResponse.next();
  if (result !== null) applyRateLimitHeaders(res.headers, result.limit, result.remaining, result.resetAt);
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
  '/consentimentos',
  '/moderacao',
  '/encaminhamentos',
  '/admin',
] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Decide a categoria de rate limit a partir da rota, do método e do cookie de
 * sessão.
 *
 * `registration` (USP-050 · PUB-2/SOC-1) exige o segmento **exato** do fluxo
 * público (`/cadastro` ou `/cadastro/…`, ex.: `/cadastro/consentimento`) **e**
 * uma **mutação** (método ≠ GET/HEAD — Server Actions/form submits são sempre
 * POST). GET/HEAD/prefetch caem em `anonymous`/`authenticated` normal
 * (RL-MN-02); `/cadastro-assistido` (fluxo interno da AS) nunca casa o
 * segmento exato, então nunca entra em `registration` (RL-MN-03).
 */
function resolveCategory(request: NextRequest): RateLimitCategory {
  const path = request.nextUrl.pathname;
  const isPublicCadastro = path === '/cadastro' || path.startsWith('/cadastro/');
  const isMutation = request.method !== 'GET' && request.method !== 'HEAD';
  if (isPublicCadastro && isMutation) {
    return 'registration';
  }
  // Recuperação de senha (USP-005) e reivindicação de credencial (USP-003):
  // endpoints públicos de identidade que disparam fluxo sensível/e-mail — teto
  // por IP mais baixo, em adição ao CAPTCHA da Server Action (ADR-0014).
  if (path.startsWith('/recuperar-senha') || path.startsWith('/reivindicar-credencial')) {
    return 'passwordReset';
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
 * Aplica o middleware a rotas autenticadas, ao fluxo de auth e a `/api` (H2,
 * Fase 6 — hardening: só para os headers de segurança — ver branch dedicado
 * acima, que retorna antes do rate-limit/gate de sessão).
 * Exclui arquivos estáticos e Next.js assets (não penaliza ISR).
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, manifest, robots, sitemap
     * - arquivos com extensão (favicon, fontes, imagens)
     * `api` NÃO é mais excluído (H2): o branch dedicado acima garante que
     * essas rotas só recebem headers, nunca rate-limit/redirect.
     */
    // Literal de string (não `String.raw`): o build do Next exige um nó
    // estático e analisável no `config.matcher` (não um TaggedTemplateExpression).
    '/((?!_next/static|_next/image|favicon.ico|manifest|robots|sitemap|.*\\..*).+)',
  ],
};
