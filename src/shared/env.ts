import { z } from 'zod';

/**
 * Validação de variáveis de ambiente com Zod (CLAUDE.md / project-guideline §14).
 * O build/boot falha se uma variável obrigatória estiver ausente ou malformada.
 *
 * Convenção: variáveis expostas ao browser usam o prefixo `NEXT_PUBLIC_`.
 * Segredos nunca vão para o cliente nem para `.env.example` (apenas placeholders).
 */
const envSchema = z.object({
  // Ambiente
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Banco de dados (Supabase Postgres) — ADR-T-0002
  DATABASE_URL: z.string().url(), // Pooler (PgBouncer) — runtime da aplicação
  DIRECT_URL: z.string().url(), // Conexão direta — migrations Prisma

  // Supabase Auth + Storage — ADR-0003 / ADR-0005
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // E-mail transacional (Resend)
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().email(),

  // Observabilidade (Sentry) — opcional em dev (string vazia = ausente)
  NEXT_PUBLIC_SENTRY_DSN: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().optional(),
  ),
  SENTRY_ENVIRONMENT: z.enum(['development', 'staging', 'production']).default('development'),

  // CAPTCHA (Cloudflare Turnstile) — ADR-0014
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),

  // LLM (Anthropic) — extração de CV, ADR-0012
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1).default('claude-sonnet-4-6'),

  // Backup duplo (Backblaze B2) — ADR-0006
  B2_KEY_ID: z.string().min(1),
  B2_APPLICATION_KEY: z.string().min(1),
  B2_BUCKET: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(raiz)'}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Variáveis de ambiente inválidas ou ausentes:\n${issues}\n` +
        'Verifique seu .env.local (veja .env.example).',
    );
  }
  return parsed.data;
}

export const env = loadEnv();
