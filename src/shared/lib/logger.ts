import pino, { type Logger } from 'pino';

/**
 * Logger estruturado (pino). Nível controlado por LOG_LEVEL.
 * Em produção, saída JSON (ingestão por Vercel/Sentry); em dev, legível.
 */
const isProd = process.env.NODE_ENV === 'production';

/**
 * Baseline de redação (LGPD / ADR-0009): nunca emitir PII ou segredos no log.
 * Cobre cabeçalhos de auth, credenciais e os campos sensíveis mais comuns do
 * domínio (pessoa unificada). Cada campo é registrado em três alvos para cobrir
 * profundidade arbitrária, já que os wildcards do pino casam UM nível por `*`:
 *   • `campo`     → raiz do objeto logado
 *   • `*.campo`   → um nível de aninhamento (ex.: `pessoa.email`)
 *   • `*.*.campo` → dois níveis (ex.: `pessoa.contato.email`)
 * Módulos podem estender via `childLogger`, mas estes paths valem por padrão em
 * toda a aplicação. Ao logar PII mais profunda, achate o objeto antes de emitir.
 */
const SENSITIVE_FIELDS = [
  'password',
  'senha',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'apiKey',
  'secret',
  'cpf',
  'rg',
  'email',
  'telefone',
  'phone',
];

const REDACT_PATHS = [
  ...SENSITIVE_FIELDS,
  ...SENSITIVE_FIELDS.map((f) => `*.${f}`),
  ...SENSITIVE_FIELDS.map((f) => `*.*.${f}`),
  'req.headers.authorization',
  'req.headers.cookie',
];

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        },
      }),
});

/** Cria um logger filho com contexto fixo (ex.: módulo, requestId). */
export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
