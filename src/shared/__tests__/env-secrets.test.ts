import { describe, it, expect } from 'vitest';
import { envSchema } from '@/shared/env';

/**
 * Hardening US #200 / #205 — guarda de regressão sobre a fronteira de secrets.
 *
 * Garante que (a) todo secret server-side está coberto pelo schema Zod e
 * (b) nenhum secret recebe o prefixo `NEXT_PUBLIC_` (que vazaria para o bundle
 * client). As variáveis públicas ficam numa whitelist explícita — adicionar uma
 * nova `NEXT_PUBLIC_*` exige atualizar este teste, forçando a revisão consciente.
 */

const schemaKeys = Object.keys(envSchema.shape);

/** Secrets que NUNCA podem ir para o cliente (server-only). */
const SERVER_SECRETS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'TURNSTILE_SECRET_KEY',
  'ANTHROPIC_API_KEY',
  'B2_KEY_ID',
  'B2_APPLICATION_KEY',
];

/** Variáveis intencionalmente expostas ao browser (revisadas). */
const ALLOWED_PUBLIC = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SENTRY_DSN',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
]);

describe('env — fronteira de secrets (#205)', () => {
  it('todo secret server-side está coberto pelo schema Zod', () => {
    for (const secret of SERVER_SECRETS) {
      expect(schemaKeys, `${secret} ausente do envSchema`).toContain(secret);
    }
  });

  it('nenhum secret server-side usa o prefixo NEXT_PUBLIC_', () => {
    for (const secret of SERVER_SECRETS) {
      expect(secret.startsWith('NEXT_PUBLIC_')).toBe(false);
    }
  });

  it('toda variável NEXT_PUBLIC_ do schema está na whitelist revisada', () => {
    const publicVars = schemaKeys.filter((k) => k.startsWith('NEXT_PUBLIC_'));
    for (const v of publicVars) {
      expect(ALLOWED_PUBLIC.has(v), `${v} exposta ao client sem revisão`).toBe(true);
    }
  });

  it('a chave secreta do Turnstile é server-only; só a site key é pública', () => {
    expect(schemaKeys).toContain('TURNSTILE_SECRET_KEY');
    expect(schemaKeys).toContain('NEXT_PUBLIC_TURNSTILE_SITE_KEY');
    expect('TURNSTILE_SECRET_KEY'.startsWith('NEXT_PUBLIC_')).toBe(false);
  });
});
