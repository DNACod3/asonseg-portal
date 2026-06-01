import { env } from '@/shared/env';

/**
 * Verificação server-side do CAPTCHA Cloudflare Turnstile — Hardening US #200 / #203
 * (ADR-0014). Centraliza a chamada ao endpoint `siteverify` para que todos os
 * fluxos públicos sensíveis (auto-cadastro USP-001, reivindicação USP-003,
 * recuperação de senha USP-005) validem o token da mesma forma.
 *
 * **Fail-closed (ADR-0014):** qualquer erro de rede/timeout/resposta malformada
 * resulta em `{ ok: false }` — preferimos barrar um cadastro legítimo a deixar
 * passar um bot. O segredo (`TURNSTILE_SECRET_KEY`) só existe no servidor.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const DEFAULT_TIMEOUT_MS = 5_000;

export interface TurnstileVerifyResult {
  /** `true` somente quando o Cloudflare confirmou o desafio. */
  readonly ok: boolean;
  /** Primeiro `error-code` do Turnstile (para audit log / diagnóstico). */
  readonly errorCode?: string;
}

export interface VerifyTurnstileOptions {
  /** IP do cliente (`remoteip`) — reforça a validação quando disponível. */
  readonly remoteIp?: string;
  /** Timeout da chamada ao Cloudflare (ms). */
  readonly timeoutMs?: number;
  /** Injeção de `fetch` para teste; default usa o global. */
  readonly fetchImpl?: typeof fetch;
  /** Segredo override (teste); default lê de `env.TURNSTILE_SECRET_KEY`. */
  readonly secret?: string;
}

/** Forma relevante da resposta do `siteverify`. */
interface SiteVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

/**
 * Valida um token Turnstile contra o Cloudflare. Retorna `{ ok: false }` (nunca
 * lança) em token ausente/inválido, timeout ou indisponibilidade da API.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  options: VerifyTurnstileOptions = {},
): Promise<TurnstileVerifyResult> {
  if (!token || typeof token !== 'string') {
    return { ok: false, errorCode: 'missing-input-response' };
  }

  const doFetch = options.fetchImpl ?? fetch;
  const secret = options.secret ?? env.TURNSTILE_SECRET_KEY;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (options.remoteIp) body.set('remoteip', options.remoteIp);

    const response = await doFetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, errorCode: `http-${response.status}` };
    }

    const data = (await response.json()) as SiteVerifyResponse;
    return {
      ok: data.success === true,
      errorCode: data.success === true ? undefined : data['error-codes']?.[0] ?? 'unknown',
    };
  } catch (err) {
    // Timeout (abort) ou falha de rede — fail-closed.
    const errorCode = err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'network-error';
    return { ok: false, errorCode };
  } finally {
    clearTimeout(timeout);
  }
}
