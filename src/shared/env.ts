import { z } from 'zod';
import { parseBooleanFlag } from './lib/env-flags';

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
  // Ambiente do deploy Vercel (ADR-0019). Injetado automaticamente pela Vercel
  // (`production` | `preview` | `development`); ausente em CI/local. Usado para
  // distinguir um deploy real de um build de produção rodado em CI/E2E.
  VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),

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
  // URL pública base da aplicação — monta links absolutos em e-mails (ex.: link
  // de redefinição de senha, USP-005). Obrigatória (fail-fast — CLAUDE.md §Env):
  // sem default para não emitir silenciosamente links `localhost` em produção;
  // o boot falha se faltar. Em dev/CI/test é setada com o host local.
  NEXT_PUBLIC_SITE_URL: z.string().url(),

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

  // Autenticação (USP-004) — ADR-0029 / DEC-012
  // Retenção de tentativas de login (email + IP) para anti-brute-force/DoS.
  // Tunável; pendente validação LGPD da DPO (DEC-012).
  AUTH_ATTEMPTS_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  // Feature flag de bloqueio do login (manutenção / rollback emergencial).
  AUTH_LOGIN_ENABLED: z
    .preprocess((v) => (typeof v === 'string' ? v.toLowerCase() !== 'false' : v), z.boolean())
    .default(true),

  // Segredo dos jobs de cron (Vercel Cron). Protege os route handlers em
  // `/api/cron/*` contra acionamento externo. Opcional em dev (string vazia = ausente).
  CRON_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),

  // Desliga o rate limiting do middleware. Destinado a E2E/dev local e ao E2E de
  // CI (o volume de requests do Next + Playwright estoura o teto anônimo de
  // 10/min). Num deploy real da Vercel é proibido (trava no boot — ver
  // `superRefine` abaixo).
  //
  // Parse via `parseBooleanFlag` (USP-050 · PUB-1a): aceita as grafias usuais
  // (true/1/yes/on, false/0/no/off/'') e devolve qualquer valor não reconhecido
  // cru, fazendo `z.boolean()` reprovar e o boot falhar ruidoso — em vez do
  // parse anterior (`=== 'true'`), que resolvia grafias como '1' em `false`
  // silenciosamente (RL-MN-04).
  RATE_LIMIT_DISABLED: z.preprocess(parseBooleanFlag, z.boolean()).default(false),

  // Liga o `FakeCVExtractor` no container em vez do adapter Anthropic
  // (USP-040 / A-12) — E2E/teste determinístico sem chamada real ao LLM. Num
  // deploy real da Vercel é proibido (trava no boot — mesmo padrão de
  // `RATE_LIMIT_DISABLED`, ver `superRefine` abaixo). Mesmo parser fail-loud
  // (USP-050 · PUB-1a) — mesma frouxidão de idioma, mesmo guard Vercel.
  CV_EXTRACTOR_FAKE: z.preprocess(parseBooleanFlag, z.boolean()).default(false),
});

/**
 * Schema usado no parse de runtime: o `envSchema` base + invariantes entre
 * campos. Mantemos os dois separados para que `envSchema.shape` continue
 * disponível (guarda de regressão de secrets em `env-secrets.test.ts`).
 */
const runtimeEnvSchema = envSchema.superRefine((env, ctx) => {
  // Fail-closed: nunca permitir desligar o rate limiting (hardening US #200 /
  // ADR-0029) num deploy real da Vercel. Se a flag vazar para o ambiente de um
  // deploy, o boot falha de forma ruidosa em vez de silenciosamente derrubar a
  // proteção do `/login` e demais rotas. Mira `VERCEL_ENV` (deploy real), não
  // `NODE_ENV` — o build de produção rodado em CI/E2E também é `production`, mas
  // ali precisamos da flag para o Playwright não estourar o teto anônimo.
  const isVercelDeploy = env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview';
  if (isVercelDeploy && env.RATE_LIMIT_DISABLED) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['RATE_LIMIT_DISABLED'],
      message:
        'RATE_LIMIT_DISABLED não pode ser `true` num deploy Vercel (production/preview) — ' +
        'hardening US #200 / ADR-0029. Use apenas em desenvolvimento/E2E.',
    });
  }
  // Mesmo guard fail-closed para o fake do CVExtractor (USP-040 / CVE-MN-05 —
  // risco listado em design.md): nunca deixar o fake vazar para um deploy real.
  if (isVercelDeploy && env.CV_EXTRACTOR_FAKE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CV_EXTRACTOR_FAKE'],
      message:
        'CV_EXTRACTOR_FAKE não pode ser `true` num deploy Vercel (production/preview) — ' +
        'USP-040. Use apenas em desenvolvimento/E2E.',
    });
  }
});

export type Env = z.infer<typeof envSchema>;

export { envSchema };

/**
 * Valida uma fonte de env (default: `process.env`). Lança com mensagem agregada
 * em PT-BR quando alguma variável obrigatória está ausente ou malformada.
 */
export function parseEnv(source: Record<string, unknown> = process.env): Env {
  const parsed = runtimeEnvSchema.safeParse(source);
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

export const env = parseEnv();
