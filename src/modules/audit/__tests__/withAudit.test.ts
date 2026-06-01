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
        audit.after = { id: audit.entityId, nome: 'Maria' };
        return { ok: true };
      },
      {
        actorUserId: '33333333-3333-3333-3333-333333333333',
        actorPersonId: '22222222-2222-2222-2222-222222222222',
        ip: '203.0.113.7',
        userAgent: 'UA/1',
      },
    );

    expect(result).toEqual({ ok: true });
    expect(auditCreate).toHaveBeenCalledTimes(1);
    const data = auditCreate.mock.calls[0]![0].data;
    expect(data.action).toBe('PERSON_CREATED_PUBLIC');
    expect(data.actorUserId).toBe('33333333-3333-3333-3333-333333333333');
    expect(data.actorPersonId).toBe('22222222-2222-2222-2222-222222222222');
    expect(data.ip).toBe('203.0.113.7');
    expect(data.userAgent).toBe('UA/1');
    expect(data.entityType).toBe('person');
    expect(data.after).toEqual({ id: '11111111-1111-1111-1111-111111111111', nome: 'Maria' });
    expect(data.before).toBe(Prisma.DbNull); // INSERT não tem before
  });

  it('grava só o id (select) — não devolve before/after pela conexão', async () => {
    await withAudit(AuditEvent.JOB_PUBLISHED, async (_t, audit) => {
      audit.after = { id: 'x' };
    });
    expect(auditCreate.mock.calls[0]![0].select).toEqual({ id: true });
  });

  it('normaliza before/after (Date -> ISO, BigInt -> string) sem lançar', async () => {
    const when = new Date('2026-01-02T03:04:05.000Z');
    await withAudit(AuditEvent.JOB_PUBLISHED, async (_t, audit) => {
      audit.before = { publishedAt: null };
      audit.after = { publishedAt: when, views: 10n };
    });

    const data = auditCreate.mock.calls[0]![0].data;
    expect(data.before).toEqual({ publishedAt: null }); // null aninhado é preservado
    expect(data.after).toEqual({ publishedAt: '2026-01-02T03:04:05.000Z', views: '10' });
  });

  it('normaliza Date/BigInt aninhados em objetos e arrays', async () => {
    const when = new Date('2026-01-02T03:04:05.000Z');
    await withAudit(AuditEvent.JOB_PUBLISHED, async (_t, audit) => {
      audit.after = {
        meta: { criadoEm: when, contador: 99n },
        historico: [{ em: when }, { total: 5n }],
        invalido: Number.POSITIVE_INFINITY,
      };
    });

    const data = auditCreate.mock.calls[0]![0].data;
    expect(data.after).toEqual({
      meta: { criadoEm: '2026-01-02T03:04:05.000Z', contador: '99' },
      historico: [{ em: '2026-01-02T03:04:05.000Z' }, { total: '5' }],
      invalido: null, // números não-finitos viram null (nunca lança)
    });
  });

  it('converte null/undefined no topo de before/after para SQL NULL (DbNull)', async () => {
    await withAudit(AuditEvent.JOB_PUBLISHED, async (_t, audit) => {
      audit.before = null;
      audit.after = undefined;
    });

    const data = auditCreate.mock.calls[0]![0].data;
    expect(data.before).toBe(Prisma.DbNull);
    expect(data.after).toBe(Prisma.DbNull);
  });

  it('minimiza PII: mascara campos sensíveis em qualquer profundidade ([REDACTED])', async () => {
    await withAudit(AuditEvent.PERSON_CREATED_PUBLIC, async (_t, audit) => {
      audit.after = {
        id: '1',
        email: 'maria@exemplo.com',
        passwordHash: '$2a$10$abc',
        cpf: '123.456.789-00',
        contato: { telefone: '+5511999999999', resetToken: 'tok_123' },
        tags: ['ok'],
      };
    });

    const data = auditCreate.mock.calls[0]![0].data;
    expect(data.after).toEqual({
      id: '1',
      email: '[REDACTED]',
      passwordHash: '[REDACTED]', // camelCase tokenizado -> password
      cpf: '[REDACTED]',
      contato: { telefone: '[REDACTED]', resetToken: '[REDACTED]' }, // aninhado
      tags: ['ok'], // chave não-sensível preservada
    });
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
