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
 *
 * **Limitação de arrays (H4, Fase 6 — hardening; fato confirmado do
 * pino/fast-redact):** wildcards `*.campo` NÃO atravessam arrays — um
 * elemento de array exige path explícito com o pai conhecido (ex.:
 * `pessoas[*].email`), e o fast-redact só aceita **um** wildcard por path;
 * uma redação universal deep+array é impossível estaticamente. Levantamento
 * do código (Fase 6 — hardening) não encontrou nenhum `log.*` atual que emita
 * um array de objetos com PII (as chamadas existentes logam `personId`/ids
 * escalares); por isso nenhum path `pai[*].campo` foi adicionado — é resíduo
 * documentado, não uma lacuna silenciosa. Se um caller futuro precisar logar
 * um array de PII, achate os campos sensíveis antes de logar OU adicione o
 * path explícito aqui.
 */
export const SENSITIVE_FIELDS = [
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
  // PII do domínio (H4, Fase 6 — hardening / ADR-0009): nomes reais
  // verificados em `prisma/schema.prisma` (Person.fullAddress/birthDate) e no
  // módulo `cv-extraction` (`domain/extracted-fields.ts` — texto bruto
  // extraído do CV). Escopado a nomes de PII de pessoa — NÃO inclui
  // `name`/`nome` genéricos (redigiria `category.name`, `module`, etc.).
  'fullAddress',
  'endereco',
  'birthDate',
  'experienceText',
  'skillsText',
  'coursesText',
];

// Exportado (não apenas interno) para que o teste de redação (H4,
// logger.test.ts) monte um pino real com a MESMA config de produção — sem
// isso, não haveria como testar a redação de ponta a ponta (o `logger`
// exportado abaixo usa `pino-pretty`/transport assíncrono fora de produção).
export const REDACT_PATHS = [
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
