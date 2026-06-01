import { describe, it, expect, vi, beforeEach } from 'vitest';

// O singleton não é usado aqui (injetamos um client), mas o barrel o importa.
vi.mock('@/shared/lib/prisma', () => ({ prisma: {} }));

import { purgeExpiredAuditLogs, AUDIT_RETENTION_DAYS } from '@/modules/audit';
import type { PrismaClient } from '@prisma/client';

const execRaw = vi.fn().mockResolvedValue(0);
const deleteMany = vi.fn().mockResolvedValue({ count: 7 });
const create = vi.fn().mockResolvedValue({ id: 1n });

const tx = { $executeRawUnsafe: execRaw, auditLog: { deleteMany, create } };
const client = {
  $transaction: (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
} as unknown as PrismaClient;

beforeEach(() => {
  execRaw.mockClear();
  deleteMany.mockClear();
  create.mockClear();
});

describe('audit/retention', () => {
  it('retém 1 ano (365 dias)', () => {
    expect(AUDIT_RETENTION_DAYS).toBe(365);
  });

  it('apaga registros anteriores ao corte de 1 ano e devolve a contagem', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const { deleted, cutoff } = await purgeExpiredAuditLogs(now, client);

    expect(deleted).toBe(7);
    expect(cutoff.toISOString()).toBe('2025-06-01T00:00:00.000Z');

    expect(deleteMany).toHaveBeenCalledWith({ where: { occurredAt: { lt: cutoff } } });
  });

  it('libera o trigger append-only via SET LOCAL antes do DELETE', async () => {
    await purgeExpiredAuditLogs(new Date('2026-06-01T00:00:00.000Z'), client);

    expect(execRaw).toHaveBeenCalledWith("SET LOCAL app.audit_purge = 'on'");
    // SET LOCAL deve preceder o deleteMany.
    expect(execRaw.mock.invocationCallOrder[0]).toBeLessThan(
      deleteMany.mock.invocationCallOrder[0]!,
    );
  });

  it('registra um evento AUDIT_LOG_PURGED com o resumo da poda', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await purgeExpiredAuditLogs(now, client);

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0]![0].data;
    expect(data.action).toBe('AUDIT_LOG_PURGED');
    expect(data.context).toMatchObject({
      deleted: 7,
      retentionDays: 365,
      cutoff: '2025-06-01T00:00:00.000Z',
    });
  });
});
