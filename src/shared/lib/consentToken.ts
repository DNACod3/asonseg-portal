import crypto from 'node:crypto';
import { env } from '@/shared/env';

/**
 * HMAC de curta duração para o fluxo de aceite de consentimento (TX2 do
 * auto-cadastro USP-001 / P-002). Garante que apenas quem passou pela TX1
 * pode acionar a TX2 para um dado personId, evitando que terceiros que
 * obtenham o UUID da URL ativem consentimentos alheios.
 *
 * A chave é o SUPABASE_SERVICE_ROLE_KEY (já existente, server-only).
 * Tokens são válidos indefinidamente enquanto a chave não rodar, o que é
 * aceitável dado o ciclo de vida de minutos deste token na prática.
 */
export function signConsentToken(personId: string, role: string): string {
  return crypto
    .createHmac('sha256', env.SUPABASE_SERVICE_ROLE_KEY)
    .update(`consent:${personId}:${role}`)
    .digest('hex');
}

export function verifyConsentToken(
  personId: string,
  role: string,
  token: string | undefined,
): boolean {
  if (!token || token.length !== 64) return false;
  const expected = signConsentToken(personId, role);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(token, 'hex'),
    );
  } catch {
    return false;
  }
}
