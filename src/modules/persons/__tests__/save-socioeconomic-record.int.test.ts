import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração da Server Action saveSocioeconomicRecord (USP-036 / T5).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Mocks: next/headers (IP/UA), @/modules/identity (operador autenticado) e
 * @/modules/audit (só para o caso MN-02 de falha forçada — envolve o `withAudit`
 * real com um controle que injeta falha DEPOIS do upsert já ter rodado dentro da
 * MESMA transação Postgres, provando que o rollback é atômico).
 * Real: Prisma/Postgres — upsert da ficha + audit_log.
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest/int' })),
}));

const AS_ID = 'aaaaaaaa-1000-4000-8000-000000000001';
const AS_SUPA = 'aaaaaaaa-1000-4000-8000-000000000002';

let mockOperator: CurrentPerson | null = {
  id: AS_ID,
  supabaseUserId: AS_SUPA,
  fullName: 'Assistente Social Teste',
  status: 'ATIVO',
  primeiroAcesso: false,
  roles: ['SOCIAL_ASSISTANT'],
  phone: null,
  fullAddress: null,
};

vi.mock('@/modules/identity', () => ({
  getCurrentPerson: vi.fn(async () => mockOperator),
}));

const auditOverride: { forceFailureAfterWrite: boolean } = { forceFailureAfterWrite: false };
vi.mock('@/modules/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/audit')>();
  return {
    ...actual,
    withAudit: async (
      event: Parameters<typeof actual.withAudit>[0],
      fn: Parameters<typeof actual.withAudit>[1],
      ctx: Parameters<typeof actual.withAudit>[2],
    ) =>
      actual.withAudit(
        event,
        async (tx, audit) => {
          const result = await fn(tx, audit);
          // MN-02: simula falha na ETAPA de auditoria (após o upsert já ter
          // rodado dentro do callback, mas ANTES do commit da transação) —
          // prova que `withAudit` faz rollback atômico do upsert junto.
          if (auditOverride.forceFailureAfterWrite) {
            throw new Error('forced audit failure (test — MN-02)');
          }
          return result;
        },
        ctx,
      ),
  };
});

const { prisma } = await import('@/shared/lib/prisma');
const { saveSocioeconomicRecord } = await import('../actions/save-socioeconomic-record');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('saveSocioeconomicRecord — integração', () => {
  const createdIds: string[] = [];

  function asOperator(roles: string[]) {
    mockOperator = {
      id: AS_ID,
      supabaseUserId: AS_SUPA,
      fullName: 'Assistente Social Teste',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles,
      phone: null,
      fullAddress: null,
    };
  }

  async function makePerson(status: 'ATIVO' | 'INATIVO' = 'ATIVO'): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.person.create({
      data: { id, fullName: 'Pessoa Alvo', status },
      select: { id: true },
    });
    createdIds.push(id);
    return id;
  }

  afterEach(async () => {
    for (const id of createdIds) {
      await prisma.socioeconomicRecord.deleteMany({ where: { personId: id } });
      await prisma.person.deleteMany({ where: { id } });
    }
    createdIds.length = 0;
    auditOverride.forceFailureAfterWrite = false;
    asOperator(['SOCIAL_ASSISTANT']);
  });

  it('happy create: 1ª gravação persiste os 4 campos e audita SOCIAL_SHEET_CREATED', async () => {
    const targetId = await makePerson();

    const result = await saveSocioeconomicRecord({
      personId: targetId,
      incomeBracket: 'UP_TO_1_MW',
      socialBenefit: 'Bolsa Família',
      housingSituation: 'RENTED',
      familyComposition: '4 pessoas',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.personId).toBe(targetId);

    const record = await prisma.socioeconomicRecord.findUnique({ where: { personId: targetId } });
    expect(record?.incomeBracket).toBe('UP_TO_1_MW');
    expect(record?.socialBenefit).toBe('Bolsa Família');
    expect(record?.housingSituation).toBe('RENTED');
    expect(record?.familyComposition).toBe('4 pessoas');
    expect(record?.updatedByPersonId).toBe(AS_ID);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'SOCIAL_SHEET_CREATED', entityId: targetId },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorPersonId).toBe(AS_ID);
  });

  it('happy update: 2ª gravação atualiza e reabre com o novo valor, audita SOCIAL_SHEET_UPDATED', async () => {
    const targetId = await makePerson();

    await saveSocioeconomicRecord({ personId: targetId, incomeBracket: 'NO_INCOME' });

    const updated = await saveSocioeconomicRecord({
      personId: targetId,
      incomeBracket: 'ABOVE_3_MW',
      socialBenefit: 'Auxílio Brasil',
    });
    expect(updated.ok).toBe(true);

    const record = await prisma.socioeconomicRecord.findUnique({ where: { personId: targetId } });
    expect(record?.incomeBracket).toBe('ABOVE_3_MW');
    expect(record?.socialBenefit).toBe('Auxílio Brasil');

    const createdAudits = await prisma.auditLog.count({
      where: { action: 'SOCIAL_SHEET_CREATED', entityId: targetId },
    });
    const updatedAudits = await prisma.auditLog.count({
      where: { action: 'SOCIAL_SHEET_UPDATED', entityId: targetId },
    });
    expect(createdAudits).toBe(1);
    expect(updatedAudits).toBe(1);
  });

  it('Zod-fail: incomeBracket fora da taxonomia retorna VALIDATION sem tocar o banco', async () => {
    const targetId = await makePerson();
    const result = await saveSocioeconomicRecord({
      personId: targetId,
      incomeBracket: 'RICO' as never,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');

    const record = await prisma.socioeconomicRecord.findUnique({ where: { personId: targetId } });
    expect(record).toBeNull();
  });

  it.each(['COORDINATOR', 'VOLUNTEER'])(
    'SOC-036-MN-01: operador %s recebe FORBIDDEN e nenhuma linha é persistida',
    async (role) => {
      const targetId = await makePerson();
      asOperator([role]);

      const result = await saveSocioeconomicRecord({
        personId: targetId,
        incomeBracket: 'UP_TO_1_MW',
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('FORBIDDEN');

      const record = await prisma.socioeconomicRecord.findUnique({ where: { personId: targetId } });
      expect(record).toBeNull();
    },
  );

  it('edge: editar ficha de Pessoa INATIVO persiste normalmente (sem delete/bloqueio)', async () => {
    const targetId = await makePerson('INATIVO');

    const result = await saveSocioeconomicRecord({
      personId: targetId,
      housingSituation: 'HOMELESS',
    });
    expect(result.ok).toBe(true);

    const record = await prisma.socioeconomicRecord.findUnique({ where: { personId: targetId } });
    expect(record?.housingSituation).toBe('HOMELESS');

    const person = await prisma.person.findUnique({ where: { id: targetId } });
    expect(person?.status).toBe('INATIVO');
  });

  it('SOC-036-MN-02: após OK existe exatamente 1 audit_log SOCIAL_SHEET_* com actorPersonId + timestamp', async () => {
    const targetId = await makePerson();
    const before = new Date();

    await saveSocioeconomicRecord({ personId: targetId, incomeBracket: 'NO_INCOME' });

    const audits = await prisma.auditLog.findMany({
      where: { entityId: targetId, action: { in: ['SOCIAL_SHEET_CREATED', 'SOCIAL_SHEET_UPDATED'] } },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.actorPersonId).toBe(AS_ID);
    expect(audits[0]?.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
  });

  it('SOC-036-MN-02: falha forçada de auditoria faz rollback do upsert (nada persiste)', async () => {
    const targetId = await makePerson();
    auditOverride.forceFailureAfterWrite = true;

    const result = await saveSocioeconomicRecord({
      personId: targetId,
      incomeBracket: 'FROM_1_TO_2_MW',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INTERNAL');

    const record = await prisma.socioeconomicRecord.findUnique({ where: { personId: targetId } });
    expect(record).toBeNull();
    const audits = await prisma.auditLog.count({
      where: { entityId: targetId, action: { in: ['SOCIAL_SHEET_CREATED', 'SOCIAL_SHEET_UPDATED'] } },
    });
    expect(audits).toBe(0);
  });

  it('Pessoa-alvo inexistente recebe NOT_FOUND', async () => {
    const result = await saveSocioeconomicRecord({
      personId: '99999999-9999-4999-8999-999999999999',
      incomeBracket: 'NO_INCOME',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });

  it('não autenticado: getCurrentPerson nulo recebe UNAUTHENTICATED', async () => {
    const targetId = await makePerson();
    mockOperator = null;

    const result = await saveSocioeconomicRecord({ personId: targetId, incomeBracket: 'NO_INCOME' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNAUTHENTICATED');
  });

  it('BOARD também pode gravar a ficha (Assumption #4 — mesmo acesso da AS)', async () => {
    const targetId = await makePerson();
    asOperator(['BOARD']);

    const result = await saveSocioeconomicRecord({ personId: targetId, incomeBracket: 'NO_INCOME' });
    expect(result.ok).toBe(true);
  });
});
