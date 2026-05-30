import { prisma } from '@/shared/lib/prisma';
import { childLogger } from '@/shared/lib/logger';
import type { AuditEventName, AuditPayload } from './events';

/**
 * Wrapper canônico para Server Actions sensíveis (project-guideline §7.1).
 * Executa o callback dentro de uma transação Prisma e registra um evento de
 * auditoria append-only (ADR-0023).
 *
 * **STUB MÍNIMO** — Esta versão executa a transação e loga estruturadamente o evento.
 * O INSERT em `audit_log` será habilitado quando o model `AuditLog` for criado
 * (próxima entrega; ver IDSD/architecture/technical-design.md §4.5).
 *
 * Quando o model existir, esta função deve:
 *   1. Executar `fn(tx)`
 *   2. `await tx.auditLog.create({ data: { event, ...payload, occurredAt: new Date() } })`
 *
 * A semântica de atomicidade (ADR-0020): se a auditoria falhar, a transação
 * inteira sofre rollback e a Server Action retorna falha genérica.
 */
export async function withAudit<T>(
  event: AuditEventName,
  payload: AuditPayload,
  fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  const log = childLogger({ module: 'audit', event });

  return prisma.$transaction(async (tx) => {
    const result = await fn(tx);

    // Stub: log estruturado (até model AuditLog existir).
    log.info(
      {
        personId: payload.personId ?? null,
        ip: payload.ip ?? null,
        userAgent: payload.userAgent ?? null,
        details: payload.details,
      },
      'audit:event',
    );

    return result;
  });
}
