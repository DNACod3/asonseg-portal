import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { childLogger } from '@/shared/lib/logger';
import { AuditEvent } from './events';

/**
 * Retenção operacional do `audit_log`: 1 ano (ADR-0004 / ADR-T-0004).
 * Dados pessoais nas tabelas operacionais seguem retenção indefinida — só o
 * log de auditoria é podado.
 */
export const AUDIT_RETENTION_DAYS = 365;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PurgeResult {
  /** Quantidade de registros removidos. */
  deleted: number;
  /** Limite de corte: registros com `occurredAt < cutoff` foram removidos. */
  cutoff: Date;
}

/**
 * Remove os registros de `audit_log` com mais de {@link AUDIT_RETENTION_DAYS}.
 * Executado pelo job mensal (`scripts/purge-audit-log.ts`).
 *
 * A tabela é append-only: o trigger só libera DELETE sob a flag de sessão
 * `app.audit_purge`, setada aqui via `SET LOCAL` (escopo restrito à transação).
 * Deve rodar com conexão privilegiada (DIRECT_URL / role admin) — ver infra #205.
 *
 * O próprio purge registra um evento `AUDIT_LOG_PURGED` (com `occurredAt = now`,
 * fora da janela de corte) para deixar rastro da poda.
 *
 * @param now instante de referência (injetável — facilita teste determinístico).
 * @param client conexão a usar (default: singleton). O job injeta um client em
 *   DIRECT_URL/role admin, pois o app role não tem privilégio de DELETE.
 */
export async function purgeExpiredAuditLogs(
  now: Date = new Date(),
  client: PrismaClient = prisma,
): Promise<PurgeResult> {
  const cutoff = new Date(now.getTime() - AUDIT_RETENTION_DAYS * MS_PER_DAY);
  const log = childLogger({ module: 'audit', job: 'purge' });

  const deleted = await client.$transaction(async (tx) => {
    // Libera o DELETE no trigger append-only apenas nesta transação.
    await tx.$executeRawUnsafe("SET LOCAL app.audit_purge = 'on'");

    const res = await tx.auditLog.deleteMany({ where: { occurredAt: { lt: cutoff } } });

    await tx.auditLog.create({
      data: {
        action: AuditEvent.AUDIT_LOG_PURGED,
        context: {
          deleted: res.count,
          cutoff: cutoff.toISOString(),
          retentionDays: AUDIT_RETENTION_DAYS,
        },
      },
    });

    return res.count;
  });

  log.info({ deleted, cutoff: cutoff.toISOString() }, 'audit:purge:done');
  return { deleted, cutoff };
}
