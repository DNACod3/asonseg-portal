import '@testing-library/jest-dom/vitest';

// Fixa o fuso do processo de teste em UTC para que asserts baseados em
// getters locais de Date (ex.: conversões de timezone) sejam determinísticos,
// independentemente do fuso da máquina do dev (ex.: America/Sao_Paulo).
process.env.TZ = 'UTC';

// Env dummy para os testes: módulos que importam `shared/env` validam no load.
// Valores fake suficientes para passar no schema Zod (sem bater em SaaS real).
const TEST_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test?schema=public',
  DIRECT_URL: 'postgresql://test:test@localhost:5432/test?schema=public',
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-test',
  RESEND_API_KEY: 're_test',
  EMAIL_FROM: 'teste@asonseg.org.br',
  SENTRY_ENVIRONMENT: 'development',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  ANTHROPIC_API_KEY: 'sk-ant-test',
  B2_KEY_ID: 'b2-id',
  B2_APPLICATION_KEY: 'b2-key',
  B2_BUCKET: 'asonseg-test',
};

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] ??= value;
}
