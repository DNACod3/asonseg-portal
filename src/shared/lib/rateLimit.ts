/**
 * Rate limiting por janela deslizante (sliding-window log) — Hardening US #200 / #201.
 *
 * Núcleo puro e testável: guarda os timestamps das requisições por chave e conta
 * quantas caem dentro da janela corrente. Sem dependências de libs proibidas e
 * compatível com o Edge Runtime (apenas `Map` em memória).
 *
 * **Limitação assumida (MVP):** o store é em memória *por instância* do Edge
 * Middleware — não é compartilhado entre regiões/lambdas. Para o volume do MVP é
 * suficiente como primeira barreira anti-abuso; o endurecimento com store
 * distribuído (`@upstash/ratelimit`) está previsto para sessão futura
 * (architecture-document §"Rate limiting por IP/usuário/endpoint").
 *
 * As categorias e limites vêm de technical-design §8:
 *   - anônimo:        10 req / 1 min
 *   - autenticado:    60 req / 1 min
 *   - cadastro/IP:     3 req / 15 min
 *   - recuperação/IP:  5 req / 15 min (USP-005 — endpoint público que dispara
 *                      e-mail real; teto baixo p/ conter mail-bombing, em adição
 *                      ao CAPTCHA da Server Action)
 */

export interface RateLimitRule {
  /** Máximo de requisições permitidas dentro da janela. */
  readonly limit: number;
  /** Tamanho da janela em milissegundos. */
  readonly windowMs: number;
}

export interface RateLimitResult {
  /** `false` quando a requisição estourou o limite (deve responder 429). */
  readonly allowed: boolean;
  /** Limite configurado para a categoria (header `X-RateLimit-Limit`). */
  readonly limit: number;
  /** Requisições ainda disponíveis na janela (`X-RateLimit-Remaining`). */
  readonly remaining: number;
  /** Epoch (ms) em que a janela mais antiga libera espaço (`X-RateLimit-Reset`). */
  readonly resetAt: number;
  /** Segundos sugeridos para o header `Retry-After` quando bloqueado. */
  readonly retryAfterSeconds: number;
}

const MINUTE_MS = 60_000;

/** Limites canônicos por categoria (technical-design §8). */
export const RATE_LIMITS = {
  anonymous: { limit: 10, windowMs: MINUTE_MS },
  authenticated: { limit: 60, windowMs: MINUTE_MS },
  registration: { limit: 3, windowMs: 15 * MINUTE_MS },
  passwordReset: { limit: 5, windowMs: 15 * MINUTE_MS },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitCategory = keyof typeof RATE_LIMITS;

/**
 * Limitador por janela deslizante. Mantém uma fila de timestamps por chave e
 * descarta os que saíram da janela a cada verificação. Aceita um relógio
 * injetável (`now`) para teste determinístico.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  /**
   * Registra e avalia uma requisição para `key` sob `rule`. Conta a requisição
   * atual; retorna `allowed=false` (sem registrá-la) quando o limite já foi
   * atingido dentro da janela.
   */
  check(key: string, rule: RateLimitRule, now: number = Date.now()): RateLimitResult {
    const windowStart = now - rule.windowMs;
    const timestamps = (this.hits.get(key) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= rule.limit) {
      const oldest = timestamps[0] ?? now;
      const resetAt = oldest + rule.windowMs;
      // Persiste a janela podada (evita reprocessar timestamps expirados).
      this.hits.set(key, timestamps);
      return {
        allowed: false,
        limit: rule.limit,
        remaining: 0,
        resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);
    const oldest = timestamps[0] ?? now;
    return {
      allowed: true,
      limit: rule.limit,
      remaining: rule.limit - timestamps.length,
      resetAt: oldest + rule.windowMs,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Remove chaves cujas janelas expiraram totalmente. Chamado oportunisticamente
   * pelo middleware para evitar crescimento ilimitado do `Map` em memória.
   */
  prune(now: number = Date.now()): void {
    const longestWindow = Math.max(
      RATE_LIMITS.anonymous.windowMs,
      RATE_LIMITS.authenticated.windowMs,
      RATE_LIMITS.registration.windowMs,
      RATE_LIMITS.passwordReset.windowMs,
    );
    for (const [key, timestamps] of this.hits) {
      const alive = timestamps.filter((t) => t > now - longestWindow);
      if (alive.length === 0) this.hits.delete(key);
      else this.hits.set(key, alive);
    }
  }

  /** Quantidade de chaves rastreadas (uso em testes/observabilidade). */
  get size(): number {
    return this.hits.size;
  }

  /** Esvazia o store (uso em testes). */
  reset(): void {
    this.hits.clear();
  }
}

/**
 * Singleton de processo usado pelo Edge Middleware. Em testes, prefira instanciar
 * `SlidingWindowRateLimiter` diretamente para isolamento.
 */
export const rateLimiter = new SlidingWindowRateLimiter();
