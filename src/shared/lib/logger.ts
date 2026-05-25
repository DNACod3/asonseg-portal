import pino, { type Logger } from 'pino';

/**
 * Logger estruturado (pino). Nível controlado por LOG_LEVEL.
 * Em produção, saída JSON (ingestão por Vercel/Sentry); em dev, legível.
 */
const isProd = process.env.NODE_ENV === 'production';

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
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
