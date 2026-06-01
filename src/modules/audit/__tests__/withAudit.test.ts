import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

// Mock do singleton Prisma: `$transaction(cb)` injeta um `tx` falso e devolve o
// que o callback retornar — exercita o caminho de gravação sem banco real.
const auditCreate = vi.fn().mockResolvedValue({ id: 1n });
const tx = { auditLog: { create: auditCreate } };
vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    $transaction: (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
  },
}));

import { withAudit, AuditEvent } from '@/modules/audit';

beforeEach(() => {
  auditCreate.mockClear();
});

describe('audit/withAudit', () => {
  it('executa o callback, retorna seu resultado e grava o evento na mesma tx', async () => {
    const result = await withAudit(
      AuditEvent.PERSON_CREATED_PUBLIC,
      async (t, audit) => {
        expect(t).toBe(tx); // mesmo client transacional
        audit.entityType = 'person';
        audit.entityId = '11111111-1111-1111-1111-111111111111';
        audit.after = { id: audit.entityId, email: 'a@b.com' };
        return { ok: true };
      },
      { actorPersonId: '22222222-2222-2222-2222-222222222222', ip: '203.0.113.7', userAgent: 'UA/1' },
    );

    expect(result).toEqual({ ok: true });
    expect(auditCreate).toHaveBeenCalledTimes(1);
    const data = auditCreate.mock.calls[0]![0].data;
    expect(data.action).toBe('PERSON_CREATED_PUBLIC');
    expect(data.actorPersonId).toBe('22222222-2222-2222-2222-222222222222');
    expect(data.ip).toBe('203.0.113.7');
    expect(data.userAgent).toBe('UA/1');
    expect(data.entityType).toBe('person');
    expect(data.after).toEqual({ id: '11111111-1111-1111-1111-111111111111', email: 'a@b.com' });
    expect(data.before).toBe(Prisma.DbNull); // INSERT não tem before
  });

  it('normaliza before/after (Date -> ISO, BigInt -> string) sem lançar', async () => {
    const when = new Date('2026-01-02T03:04:05.000Z');
    await withAudit(AuditEvent.JOB_PUBLISHED, async (_t, audit) => {
      audit.before = { publishedAt: null };
      audit.after = { publishedAt: when, views: 10n };
    });

    const data = auditCreate.mock.calls[0]![0].data;
    expect(data.after).toEqual({ publishedAt: '2026-01-02T03:04:05.000Z', views: '10' });
  });

  it('mescla context do ctx e do recorder (recorder vence)', async () => {
    await withAudit(
      AuditEvent.JOB_PUBLISHED,
      async (_t, audit) => {
        audit.context = { route: '/vagas/nova', shared: 'recorder' };
      },
      { context: { requestId: 'req-1', shared: 'ctx' } },
    );

    const data = auditCreate.mock.calls[0]![0].data;
    expect(data.context).toEqual({ requestId: 'req-1', route: '/vagas/nova', shared: 'recorder' });
  });

  it('faz rollback (lança e não grava) quando falta justificativa obrigatória', async () => {
    await expect(
      withAudit(AuditEvent.CONSENT_REVOKED, async (_t, audit) => {
        audit.entityId = 'c1';
        // justificativa ausente
      }),
    ).rejects.toThrow(/justificativa/i);

    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('grava quando a justificativa obrigatória é fornecida', async () => {
    await withAudit(AuditEvent.CONSENT_REVOKED, async (_t, audit) => {
      audit.justification = 'titular solicitou revogação';
    });

    const data = auditCreate.mock.calls[0]![0].data;
    expect(data.action).toBe('CONSENT_REVOKED');
    expect(data.justification).toBe('titular solicitou revogação');
  });

  it('trata justificativa só-espaços como ausente', async () => {
    await expect(
      withAudit(AuditEvent.CONTENT_REJECTED, async (_t, audit) => {
        audit.justification = '   ';
      }),
    ).rejects.toThrow(/justificativa/i);
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
