import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { childLogger } from '@/shared/lib/logger';
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

/**
 * Normaliza um valor para coluna `Json?`: `null`/`undefined` viram SQL NULL
 * (`Prisma.DbNull`); demais valores são serializados de forma defensiva
 * (Dates -> ISO, BigInt -> string) para nunca lançar dentro da transação.
 */
function toJsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === undefined || value === null) return Prisma.DbNull;
  const normalized = JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );
  if (normalized === null || normalized === undefined) return Prisma.DbNull;
  return normalized as Prisma.InputJsonValue;
}

function mergeContext(
  base: Record<string, unknown> | null | undefined,
  override: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!base && !override) return null;
  return { ...(base ?? {}), ...(override ?? {}) };
}
