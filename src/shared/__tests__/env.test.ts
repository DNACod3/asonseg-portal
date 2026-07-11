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

  it('CV_EXTRACTOR_FAKE tem default false e aceita string "true" como booleano', () => {
    const noFlag = { ...validEnv };
    delete (noFlag as Record<string, unknown>).CV_EXTRACTOR_FAKE;
    expect(parseEnv(noFlag).CV_EXTRACTOR_FAKE).toBe(false);

    const enabled = parseEnv({ ...validEnv, CV_EXTRACTOR_FAKE: 'true' });
    expect(enabled.CV_EXTRACTOR_FAKE).toBe(true);
  });

  it('CV_EXTRACTOR_FAKE=true é aceito fora de um deploy Vercel real (dev/CI/E2E)', () => {
    expect(() =>
      parseEnv({ ...validEnv, CV_EXTRACTOR_FAKE: 'true' }),
    ).not.toThrow();
    expect(() =>
      parseEnv({ ...validEnv, CV_EXTRACTOR_FAKE: 'true', VERCEL_ENV: 'development' }),
    ).not.toThrow();
  });

  it('CV_EXTRACTOR_FAKE=true lança num deploy Vercel real (production/preview) — USP-040', () => {
    expect(() =>
      parseEnv({ ...validEnv, CV_EXTRACTOR_FAKE: 'true', VERCEL_ENV: 'production' }),
    ).toThrow(/CV_EXTRACTOR_FAKE/);
    expect(() =>
      parseEnv({ ...validEnv, CV_EXTRACTOR_FAKE: 'true', VERCEL_ENV: 'preview' }),
    ).toThrow(/CV_EXTRACTOR_FAKE/);
    // false no mesmo deploy real continua válido (regressão do guard RATE_LIMIT_DISABLED).
    expect(() =>
      parseEnv({ ...validEnv, CV_EXTRACTOR_FAKE: 'false', VERCEL_ENV: 'production' }),
    ).not.toThrow();
  });

  // USP-050 (PUB-1a) — parse robusto via parseBooleanFlag: grafias usuais,
  // fail-loud para valor desconhecido (RL-MN-04), guard Vercel intacto (RL-MN-05).
  describe('RATE_LIMIT_DISABLED / CV_EXTRACTOR_FAKE — parse robusto (USP-050)', () => {
    it('RATE_LIMIT_DISABLED aceita "1"/"true"/"on" (case-insensitive) → true (FLAG-01)', () => {
      expect(parseEnv({ ...validEnv, RATE_LIMIT_DISABLED: '1' }).RATE_LIMIT_DISABLED).toBe(true);
      expect(parseEnv({ ...validEnv, RATE_LIMIT_DISABLED: 'true' }).RATE_LIMIT_DISABLED).toBe(true);
      expect(parseEnv({ ...validEnv, RATE_LIMIT_DISABLED: 'ON' }).RATE_LIMIT_DISABLED).toBe(true);
    });

    it('RATE_LIMIT_DISABLED aceita "0"/""/ausente → false (FLAG-02)', () => {
      expect(parseEnv({ ...validEnv, RATE_LIMIT_DISABLED: '0' }).RATE_LIMIT_DISABLED).toBe(false);
      expect(parseEnv({ ...validEnv, RATE_LIMIT_DISABLED: '' }).RATE_LIMIT_DISABLED).toBe(false);
      const semFlag = { ...validEnv };
      delete (semFlag as Record<string, unknown>).RATE_LIMIT_DISABLED;
      expect(parseEnv(semFlag).RATE_LIMIT_DISABLED).toBe(false);
    });

    it('RL-MN-04 (negativo): RATE_LIMIT_DISABLED="maybe" lança citando o campo, NÃO resolve false (FLAG-03)', () => {
      expect(() => parseEnv({ ...validEnv, RATE_LIMIT_DISABLED: 'maybe' })).toThrow(
        /RATE_LIMIT_DISABLED/,
      );
    });

    it('RL-MN-04 (negativo): CV_EXTRACTOR_FAKE="maybe" lança citando o campo, NÃO resolve false (FLAG-04)', () => {
      expect(() => parseEnv({ ...validEnv, CV_EXTRACTOR_FAKE: 'maybe' })).toThrow(
        /CV_EXTRACTOR_FAKE/,
      );
    });

    it('CV_EXTRACTOR_FAKE aceita "1"/"on" (mesmo parser) → true (FLAG-04)', () => {
      expect(parseEnv({ ...validEnv, CV_EXTRACTOR_FAKE: '1' }).CV_EXTRACTOR_FAKE).toBe(true);
      expect(parseEnv({ ...validEnv, CV_EXTRACTOR_FAKE: 'on' }).CV_EXTRACTOR_FAKE).toBe(true);
    });

    it('AUTH_LOGIN_ENABLED permanece com semântica própria (!== "false"), não usa o novo parser (FLAG-04)', () => {
      // "1" não é reconhecido pela semântica antiga de AUTH_LOGIN_ENABLED (!== 'false' → true),
      // então continua resolvendo true (comportamento pré-existente, não o parser novo).
      expect(parseEnv({ ...validEnv, AUTH_LOGIN_ENABLED: '1' }).AUTH_LOGIN_ENABLED).toBe(true);
      expect(parseEnv({ ...validEnv, AUTH_LOGIN_ENABLED: 'maybe' }).AUTH_LOGIN_ENABLED).toBe(true);
      expect(parseEnv({ ...validEnv, AUTH_LOGIN_ENABLED: 'false' }).AUTH_LOGIN_ENABLED).toBe(false);
    });

    it('RL-MN-05 (negativo): VERCEL_ENV=production + RATE_LIMIT_DISABLED="1" lança (VERCEL-01)', () => {
      expect(() =>
        parseEnv({ ...validEnv, VERCEL_ENV: 'production', RATE_LIMIT_DISABLED: '1' }),
      ).toThrow(/RATE_LIMIT_DISABLED/);
    });

    it('RL-MN-05: sem VERCEL_ENV + NODE_ENV=production + RATE_LIMIT_DISABLED="true" NÃO lança (VERCEL-02, caminho CI/E2E)', () => {
      const semVercel = { ...validEnv };
      delete (semVercel as Record<string, unknown>).VERCEL_ENV;
      expect(() =>
        parseEnv({ ...semVercel, NODE_ENV: 'production', RATE_LIMIT_DISABLED: 'true' }),
      ).not.toThrow();
    });

    it('RL-MN-05: mesmo par de guard para CV_EXTRACTOR_FAKE (deploy real lança; CI/E2E sem VERCEL_ENV não lança)', () => {
      expect(() =>
        parseEnv({ ...validEnv, VERCEL_ENV: 'production', CV_EXTRACTOR_FAKE: '1' }),
      ).toThrow(/CV_EXTRACTOR_FAKE/);
      const semVercel = { ...validEnv };
      delete (semVercel as Record<string, unknown>).VERCEL_ENV;
      expect(() =>
        parseEnv({ ...semVercel, NODE_ENV: 'production', CV_EXTRACTOR_FAKE: 'true' }),
      ).not.toThrow();
    });
  });
});
