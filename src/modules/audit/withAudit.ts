import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { childLogger, SENSITIVE_FIELDS } from '@/shared/lib/logger';
import { type AuditEventName, requiresJustification } from './events';

/**
 * Wrapper canônico para escritas sensíveis (project-guideline §9, ADR-0023 / ADR-T-0004).
 *
 * Executa o callback dentro de uma transação Prisma e grava um evento de
 * auditoria **na mesma transação** — atomicidade (ADR-0020): se a gravação do
 * audit falhar (ou faltar justificativa obrigatória), a operação inteira sofre
 * rollback. A tabela `audit_log` é append-only no banco (ver migration).
 *
 * Uso canônico (AC de #12):
 * ```ts
 * await withAudit('CONSENT_REVOKED', async (tx, audit) => {
 *   const before = await tx.consent.findUniqueOrThrow({ where: { id } });
 *   const after = await tx.consent.update({ where: { id }, data: { revokedAt: new Date() } });
 *   audit.entityType = 'consent';
 *   audit.entityId = id;
 *   audit.before = before;
 *   audit.after = after;
 *   audit.justification = input.motivo;
 *   return after;
 * }, ctx);
 * ```
 *
 * Eventos simples podem ignorar o recorder: `withAudit('JOB_PUBLISHED', async (tx) => {...}, ctx)`.
 *
 * `before`/`after`/`context` passam por minimização de PII automática
 * (`normalizeJson`): chaves sensíveis do baseline LGPD (senha, token, cpf,
 * e-mail, telefone…) são gravadas como `[REDACTED]` em qualquer profundidade
 * (USP-044-P-008). Ainda assim, prefira atribuir apenas o necessário ao recorder.
 */

/** Cliente transacional interativo do Prisma (mesma conexão do `$transaction`). */
export type AuditTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Identificação do ator e origem da request. Preenchido pela Server Action a
 * partir de `getCurrentUser()` + headers (`x-forwarded-for`, `user-agent`).
 */
export interface AuditContext {
  /** Ator no plano de autenticação (Supabase Auth user id). */
  actorUserId?: string | null;
  /** Ator no plano de domínio (Pessoa). */
  actorPersonId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  /** Contexto extra da request (requestId, rota…). Sem PII. */
  context?: Record<string, unknown> | null;
}

/**
 * Recorder mutável preenchido **dentro** do callback — `before`/`after` só
 * existem após a operação rodar, por isso não cabem nos argumentos de entrada.
 */
export interface AuditRecorder {
  entityType?: string | null;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  /** Obrigatória para eventos de revogação/rejeição/edição retroativa. */
  justification?: string | null;
  /** Mesclado ao `context` do `AuditContext` (recorder tem precedência). */
  context?: Record<string, unknown> | null;
}

export type AuditFn<T> = (tx: AuditTx, audit: AuditRecorder) => Promise<T>;

export async function withAudit<T>(
  event: AuditEventName,
  fn: AuditFn<T>,
  ctx: AuditContext = {},
): Promise<T> {
  const log = childLogger({ module: 'audit', event });

  return prisma.$transaction(async (tx) => {
    const audit: AuditRecorder = {};
    const result = await fn(tx, audit);

    const justification = audit.justification?.trim() || null;
    if (requiresJustification(event) && !justification) {
      // Falha => rollback de toda a transação (ADR-0020 / ADR-0004).
      throw new Error(`Auditoria: o evento ${event} exige justificativa.`);
    }

    await tx.auditLog.create({
      data: {
        action: event,
        actorUserId: ctx.actorUserId ?? null,
        actorPersonId: ctx.actorPersonId ?? null,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        entityType: audit.entityType ?? null,
        entityId: audit.entityId ?? null,
        before: toJsonInput(audit.before),
        after: toJsonInput(audit.after),
        context: toJsonInput(mergeContext(ctx.context, audit.context)),
        justification,
      },
      // Só precisamos confirmar a gravação; não devolvemos before/after/context
      // (JSONB potencialmente grandes) pela conexão para serem descartados.
      select: { id: true },
    });

    log.info(
      {
        actorPersonId: ctx.actorPersonId ?? null,
        entityType: audit.entityType ?? null,
        entityId: audit.entityId ?? null,
        ip: ctx.ip ?? null,
      },
      'audit:event',
    );

    return result;
  });
}

const REDACTED = '[REDACTED]';

/**
 * Quebra uma chave em tokens normalizados (`accessToken` -> `access`,`token`;
 * `actor_cpf` -> `actor`,`cpf`) para casar contra o denylist de campos sensíveis.
 */
function tokenizeKey(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .map((t) => t.toLowerCase())
    .filter(Boolean);
}

/**
 * Denylist de minimização de PII para o `audit_log` (LGPD / USP-044-P-008).
 * Reaproveita o baseline de redação do logger (`SENSITIVE_FIELDS`), tokenizado
 * para casar variações camelCase/snake (`passwordHash`, `resetToken`, `actor_cpf`).
 */
const SENSITIVE_TOKENS: ReadonlySet<string> = new Set(SENSITIVE_FIELDS.flatMap(tokenizeKey));

function isSensitiveKey(key: string): boolean {
  return tokenizeKey(key).some((t) => SENSITIVE_TOKENS.has(t));
}

/**
 * Normaliza recursivamente um valor para JSON serializável **em uma única
 * passada** (sem o round-trip `JSON.parse(JSON.stringify(...))`), aplicando ao
 * mesmo tempo a minimização de PII exigida pela auditoria append-only:
 *  - `Date` -> ISO string; `bigint` -> string; números não-finitos -> `null`;
 *  - chaves sensíveis (denylist) -> `[REDACTED]` em qualquer profundidade;
 *  - `function`/`symbol`/`undefined` -> `null` (nunca lança dentro da transação).
 *
 * A tabela é imutável por 1 ano: um segredo persistido aqui é permanente, então
 * a redação é defensiva e não depende de o caller lembrar de filtrar.
 */
function normalizeJson(value: unknown): Prisma.JsonValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();

  const type = typeof value;
  if (type === 'bigint') return (value as bigint).toString();
  if (type === 'string' || type === 'boolean') return value as string | boolean;
  if (type === 'number') return Number.isFinite(value as number) ? (value as number) : null;

  if (Array.isArray(value)) return value.map(normalizeJson);

  if (type === 'object') {
    const out: Record<string, Prisma.JsonValue> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? REDACTED : normalizeJson(val);
    }
    return out;
  }

  // function / symbol — não serializável.
  return null;
}

/**
 * Normaliza um valor para coluna `Json?`: `null`/`undefined` viram SQL NULL
 * (`Prisma.DbNull`); demais valores passam por {@link normalizeJson}
 * (serialização defensiva + minimização de PII).
 */
function toJsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  const normalized = normalizeJson(value);
  if (normalized === null) return Prisma.DbNull;
  return normalized as Prisma.InputJsonValue;
}

function mergeContext(
  base: Record<string, unknown> | null | undefined,
  override: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!base && !override) return null;
  return { ...(base ?? {}), ...(override ?? {}) };
}
