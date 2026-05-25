import pino, { type Logger } from 'pino';

/**
 * Logger estruturado (pino). Nível controlado por LOG_LEVEL.
 * Em produção, saída JSON (ingestão por Vercel/Sentry); em dev, legível.
 */
const isProd = process.env.NODE_ENV === 'production';

/**
 * Baseline de redação (LGPD / ADR-0009): nunca emitir PII ou segredos no log,
 * em qualquer profundidade. Cobre cabeçalhos de auth, credenciais e os campos
 * sensíveis mais comuns do domínio (pessoa unificada). Módulos podem estender
 * via `childLogger`, mas estes paths valem por padrão em toda a aplicação.
 */
const REDACT_PATHS = [
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
  '*.password',
  '*.senha',
  '*.token',
  '*.authorization',
  '*.cpf',
  '*.rg',
  '*.email',
  '*.telefone',
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
