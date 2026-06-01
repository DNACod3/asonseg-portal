/**
 * Headers de segurança HTTP — Hardening US #200 / #201 (technical-design §8).
 *
 * Aplicados a todas as respostas via Edge Middleware. A CSP é compatível com a
 * app (Next.js + Supabase + widget Cloudflare Turnstile — ADR-0014).
 *
 * Edge-safe: sem dependências de Node. A CSP usa `'unsafe-inline'` para scripts/
 * estilos porque o Next.js 15 injeta scripts inline de hidratação; o
 * endurecimento via nonce por request é follow-up (exige reescrever a resposta
 * HTML, fora do escopo do MVP).
 */

/** Origens do Cloudflare Turnstile (script + iframe do desafio). */
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

export interface SecurityHeadersOptions {
  /**
   * Emite `Strict-Transport-Security` apenas quando servindo sob HTTPS
   * (produção). Em dev/HTTP o HSTS é omitido para não travar `localhost`.
   */
  readonly hsts?: boolean;
  /**
   * Origem do Supabase (`NEXT_PUBLIC_SUPABASE_URL`) para liberar `connect-src`
   * (Auth/Storage/Realtime). Quando ausente, a CSP mantém apenas `'self'`.
   */
  readonly supabaseOrigin?: string;
}

/** Monta o valor da `Content-Security-Policy`. */
function buildCsp(supabaseOrigin?: string): string {
  const connectSrc = ["'self'", TURNSTILE_ORIGIN];
  if (supabaseOrigin) {
    connectSrc.push(supabaseOrigin);
    // Realtime usa WebSocket — deriva wss:// da origem https://.
    connectSrc.push(supabaseOrigin.replace(/^https:/, 'wss:'));
  }

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'script-src': ["'self'", "'unsafe-inline'", TURNSTILE_ORIGIN],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    'connect-src': connectSrc,
    'frame-src': [TURNSTILE_ORIGIN],
    'upgrade-insecure-requests': [],
  };

  return Object.entries(directives)
    .map(([key, values]) => (values.length ? `${key} ${values.join(' ')}` : key))
    .join('; ');
}

/**
 * Retorna o conjunto de headers de segurança a aplicar na resposta.
 * Cobre os exigidos pela US #200: CSP, HSTS, X-Content-Type-Options,
 * X-Frame-Options/frame-ancestors e Referrer-Policy (+ Permissions-Policy).
 */
export function securityHeaders(options: SecurityHeadersOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Security-Policy': buildCsp(options.supabaseOrigin),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };

  if (options.hsts) {
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
  }

  return headers;
}

/** Aplica `securityHeaders()` a um `Headers` (mutável) de resposta. */
export function applySecurityHeaders(target: Headers, options?: SecurityHeadersOptions): void {
  for (const [key, value] of Object.entries(securityHeaders(options))) {
    target.set(key, value);
  }
}
