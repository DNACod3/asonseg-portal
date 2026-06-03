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
  NEXT_PUBLIC_SITE_URL: 'https://portal.asonseg.org.br',
  SENTRY_ENVIRONMENT: 'production',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site',
  TURNSTILE_SECRET_KEY: 'secret',
  ANTHROPIC_API_KEY: 'sk-ant',
  B2_KEY_ID: 'id',
  B2_APPLICATION_KEY: 'key',
  B2_BUCKET: 'bucket',
  AUTH_ATTEMPTS_RETENTION_DAYS: '90',
  AUTH_LOGIN_ENABLED: 'true',
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

  it('exige NEXT_PUBLIC_SITE_URL (sem default — fail-fast, USP-005)', () => {
    const semSiteUrl = { ...validEnv };
    delete semSiteUrl.NEXT_PUBLIC_SITE_URL;
    expect(() => parseEnv(semSiteUrl)).toThrow(/NEXT_PUBLIC_SITE_URL/);
    // E rejeita valor malformado (precisa ser URL).
    expect(() => parseEnv({ ...validEnv, NEXT_PUBLIC_SITE_URL: 'localhost-sem-esquema' })).toThrow(
      /NEXT_PUBLIC_SITE_URL/,
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

  it('aplica default 90 para AUTH_ATTEMPTS_RETENTION_DAYS e converte string', () => {
    const noRetention = { ...validEnv };
    delete noRetention.AUTH_ATTEMPTS_RETENTION_DAYS;
    expect(parseEnv(noRetention).AUTH_ATTEMPTS_RETENTION_DAYS).toBe(90);

    const custom = parseEnv({ ...validEnv, AUTH_ATTEMPTS_RETENTION_DAYS: '30' });
    expect(custom.AUTH_ATTEMPTS_RETENTION_DAYS).toBe(30);
  });

  it('rejeita AUTH_ATTEMPTS_RETENTION_DAYS não-positivo ou não-numérico', () => {
    expect(() => parseEnv({ ...validEnv, AUTH_ATTEMPTS_RETENTION_DAYS: '0' })).toThrow(
      /AUTH_ATTEMPTS_RETENTION_DAYS/,
    );
    expect(() => parseEnv({ ...validEnv, AUTH_ATTEMPTS_RETENTION_DAYS: 'abc' })).toThrow(
      /AUTH_ATTEMPTS_RETENTION_DAYS/,
    );
  });

  it('AUTH_LOGIN_ENABLED tem default true e aceita string "false" como booleano', () => {
    const noFlag = { ...validEnv };
    delete noFlag.AUTH_LOGIN_ENABLED;
    expect(parseEnv(noFlag).AUTH_LOGIN_ENABLED).toBe(true);

    const disabled = parseEnv({ ...validEnv, AUTH_LOGIN_ENABLED: 'false' });
    expect(disabled.AUTH_LOGIN_ENABLED).toBe(false);

    const enabled = parseEnv({ ...validEnv, AUTH_LOGIN_ENABLED: 'true' });
    expect(enabled.AUTH_LOGIN_ENABLED).toBe(true);
  });
});
