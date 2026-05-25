/**
 * Tipo de retorno canônico de Server Actions (CLAUDE.md).
 * Server Actions NUNCA usam `throw` — sempre retornam `ActionResult<T>`.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export interface ActionError {
  /** Código estável para o cliente discriminar (ex.: 'VALIDATION', 'FORBIDDEN'). */
  code: ActionErrorCode;
  /** Mensagem amigável em PT-BR. */
  message: string;
  /** Erros de campo (ex.: saída de `flatten()` do Zod). */
  fieldErrors?: Record<string, string[]>;
}

export type ActionErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'CONSENT_REQUIRED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PRECONDITION_FAILED'
  | 'INTERNAL';

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(
  code: ActionErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } };
}
