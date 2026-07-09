import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração da query getSocioeconomicRecord (USP-036 / T6).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Mocks: next/headers (IP/UA) e @/modules/identity (operador autenticado).
 * Real: Prisma/Postgres — leitura da ficha + audit_log (SENSITIVE_FIELD_VIEWED).
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest/int' })),
}));

const AS_ID = 'aaaaaaaa-2000-4000-8000-000000000001';
const AS_SUPA = 'aaaaaaaa-2000-4000-8000-000000000002';

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

const { prisma } = await import('@/shared/lib/prisma');
const { getSocioeconomicRecord } = await import('../queries/get-socioeconomic-record');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('getSocioeconomicRecord — integração', () => {
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

  async function makePersonWithRecord(): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.person.create({ data: { id, fullName: 'Pessoa Alvo', status: 'ATIVO' } });
    await prisma.socioeconomicRecord.create({
      data: {
        personId: id,
        incomeBracket: 'FROM_1_TO_2_MW',
        socialBenefit: 'Bolsa Família',
        housingSituation: 'OWNED',
        familyComposition: '3 pessoas',
        updatedByPersonId: AS_ID,
      },
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
    asOperator(['SOCIAL_ASSISTANT']);
  });

  it('AS: recebe os campos da ficha e grava SENSITIVE_FIELD_VIEWED', async () => {
    const targetId = await makePersonWithRecord();

    const result = await getSocioeconomicRecord(targetId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      personId: targetId,
      incomeBracket: 'FROM_1_TO_2_MW',
      socialBenefit: 'Bolsa Família',
      housingSituation: 'OWNED',
      familyComposition: '3 pessoas',
    });

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'SENSITIVE_FIELD_VIEWED', entityId: targetId, entityType: 'person' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorPersonId).toBe(AS_ID);
  });

  it('BOARD: também recebe os campos (Assumption #4)', async () => {
    const targetId = await makePersonWithRecord();
    asOperator(['BOARD']);

    const result = await getSocioeconomicRecord(targetId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.incomeBracket).toBe('FROM_1_TO_2_MW');
  });

  it('Pessoa sem ficha ainda: retorna ok(null) e NÃO grava SENSITIVE_FIELD_VIEWED', async () => {
    const id = crypto.randomUUID();
    await prisma.person.create({ data: { id, fullName: 'Pessoa Sem Ficha', status: 'ATIVO' } });
    createdIds.push(id);

    const result = await getSocioeconomicRecord(id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'SENSITIVE_FIELD_VIEWED', entityId: id, entityType: 'person' },
    });
    expect(audit).toBeNull();
  });

  it.each(['COORDINATOR', 'VOLUNTEER'])(
    'SOC-036-MN-01: operador %s recebe FORBIDDEN e o resultado não contém nenhum campo sensível',
    async (role) => {
      const targetId = await makePersonWithRecord();
      asOperator([role]);

      const result = await getSocioeconomicRecord(targetId);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('FORBIDDEN');
      // Nenhum campo sensível vaza no payload de erro (estruturalmente ausente).
      expect(JSON.stringify(result)).not.toMatch(/FROM_1_TO_2_MW|Bolsa Família|OWNED/);

      // Nenhuma leitura de acesso foi registrada (a guarda correu ANTES do SELECT).
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'SENSITIVE_FIELD_VIEWED', entityId: targetId },
      });
      expect(audit).toBeNull();
    },
  );

  it('não autenticado: getCurrentPerson nulo recebe UNAUTHENTICATED', async () => {
    const targetId = await makePersonWithRecord();
    mockOperator = null;

    const result = await getSocioeconomicRecord(targetId);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNAUTHENTICATED');
  });
});
