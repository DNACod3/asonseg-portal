import { describe, it, expect } from 'vitest';
import { parseEnv } from '@/shared/env';

const validEnv: Record<string, string> = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@host:6543/db?pgbouncer=true',
  DIRECT_URL: 'postgresql://u:p@host:5432/db',
  NEXT_PUBLIC_SUPABASE_URL: 'https://proj.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  RESEND_API_KEY: 're_x',
  EMAIL_FROM: 'no-reply@asonseg.org.br',
  SENTRY_ENVIRONMENT: 'production',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site',
  TURNSTILE_SECRET_KEY: 'secret',
  ANTHROPIC_API_KEY: 'sk-ant',
  B2_KEY_ID: 'id',
  B2_APPLICATION_KEY: 'key',
  B2_BUCKET: 'bucket',
};

describe('shared/env parseEnv', () => {
  it('valida um conjunto completo e aplica defaults', () => {
    const env = parseEnv(validEnv);
    expect(env.DATABASE_URL).toContain('pgbouncer');
    expect(env.LOG_LEVEL).toBe('info'); // default
    expect(env.ANTHROPIC_MODEL).toBe('claude-sonnet-4-6'); // default
  });

  it('lança quando uma variável obrigatória está ausente', () => {
    const incomplete = { ...validEnv };
    delete incomplete.DATABASE_URL;
    expect(() => parseEnv(incomplete)).toThrow(/DATABASE_URL/);
  });

  it('lança quando uma URL é malformada', () => {
    expect(() => parseEnv({ ...validEnv, DATABASE_URL: 'não-é-url' })).toThrow(
      /Variáveis de ambiente inválidas/,
    );
  });

  it('trata NEXT_PUBLIC_SENTRY_DSN vazio como ausente', () => {
    const env = parseEnv({ ...validEnv, NEXT_PUBLIC_SENTRY_DSN: '' });
    expect(env.NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();
  });

  it('aceita um DSN de Sentry válido', () => {
    const env = parseEnv({ ...validEnv, NEXT_PUBLIC_SENTRY_DSN: 'https://abc@sentry.io/1' });
    expect(env.NEXT_PUBLIC_SENTRY_DSN).toBe('https://abc@sentry.io/1');
  });

  it('rejeita LOG_LEVEL fora do enum', () => {
    expect(() => parseEnv({ ...validEnv, LOG_LEVEL: 'verbose' })).toThrow(/LOG_LEVEL/);
  });
});
