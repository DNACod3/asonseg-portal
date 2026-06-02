import { prisma } from '@/shared/lib/prisma';
import type { AuditTx } from '@/modules/audit';
import type { LockoutAttempt } from '../domain/lockout';
import type { AttemptKey, AuthAttemptsRepo } from '../ports/authAttemptsRepo';

/** Cliente Prisma ou transação interativa — escritas aceitam ambos. */
type Db = typeof prisma | AuditTx;

/**
 * Adapter Prisma da porta {@link AuthAttemptsRepo} (USP-004 — T-04).
 *
 * O e-mail é normalizado (lowercase + trim) em toda escrita/leitura, garantindo
 * que a chave de lockout `(email, ip)` seja estável independentemente de como o
 * usuário digitou. Escritas aceitam um `tx` para participar da transação do
 * `withAudit` (atomicidade com o `audit_log` — design.md §7).
 */
export class PrismaAuthAttemptsRepo implements AuthAttemptsRepo {
  async record(
    input: AttemptKey & { outcome: 'SUCCESS' | 'FAILURE' },
    tx?: AuditTx,
  ): Promise<void> {
    const db: Db = tx ?? prisma;
    await db.authAttempt.create({
      data: {
        email: normalizeEmail(input.email),
        ip: input.ip,
        outcome: input.outcome,
      },
    });
  }

  async recent(input: AttemptKey & { windowMs: number }): Promise<LockoutAttempt[]> {
    const since = new Date(Date.now() - input.windowMs);
    const rows = await prisma.authAttempt.findMany({
      where: {
        email: normalizeEmail(input.email),
        ip: input.ip,
        attemptedAt: { gte: since },
      },
      select: { outcome: true, attemptedAt: true },
      orderBy: { attemptedAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => ({ outcome: r.outcome, attemptedAt: r.attemptedAt }));
  }

  async reset(input: AttemptKey, tx?: AuditTx): Promise<void> {
    const db: Db = tx ?? prisma;
    await db.authAttempt.deleteMany({
      where: { email: normalizeEmail(input.email), ip: input.ip },
    });
  }
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
