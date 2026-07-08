import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

/**
 * Autenticação de rotas de cron (padrão `auth-attempts-retention`, extraído em
 * USP-024/T3 para reuso). `missing_secret` = `CRON_SECRET` não configurado no
 * ambiente ⇒ a rota deve responder `503` (fail-closed, nunca expor a operação
 * sem segredo); `unauthorized` = segredo ausente/incorreto ⇒ `401`; `ok` ⇒ segue.
 */
export type CronAuthResult = 'ok' | 'missing_secret' | 'unauthorized';

/** Segredo apresentado pelo chamador: header `x-cron-secret` ou `Authorization: Bearer` (Vercel Cron). */
function extractProvidedSecret(request: NextRequest): string | null {
  return (
    request.headers.get('x-cron-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    null
  );
}

/**
 * Compara dois segredos em tempo constante. Faz hash de ambos com SHA-256 antes
 * do `timingSafeEqual` para que os buffers tenham sempre o mesmo tamanho — assim
 * não se vaza nem o tamanho nem o prefixo coincidente do segredo por timing.
 */
function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Verifica a autenticação de uma requisição de cron contra `expectedSecret` (`env.CRON_SECRET`). */
export function verifyCronSecret(request: NextRequest, expectedSecret: string | undefined): CronAuthResult {
  if (!expectedSecret) return 'missing_secret';
  const provided = extractProvidedSecret(request);
  if (!provided || !secretsMatch(provided, expectedSecret)) return 'unauthorized';
  return 'ok';
}
