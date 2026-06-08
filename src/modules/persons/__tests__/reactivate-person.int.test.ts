import { describe, it, expect, vi, afterEach } from 'vitest';
import crypto from 'node:crypto';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração da Server Action reactivatePerson (USP-045).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Mocks: next/headers (IP/UA) e @/modules/identity (operador autenticado).
 * Real: Prisma/Postgres — valida reabilitação de status (E-001), zeragem de
 * grants (E-003 / P-001), preservação de consentimentos (P-003), hierarquia
 * de rank (P-002), auditoria imutável (L-003), e idempotência.
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest/int' })),
}));

const BOARD_ID = 'bbbbbbbb-1111-4111-8111-000000000001';
const BOARD_SUPA = 'bbbbbbbb-1111-4111-8111-000000000002';
const COORD_ID = 'cccccccc-1111-4111-8111-000000000001';

let mockOperator: CurrentPerson | null = {
  id: BOARD_ID,
  supabaseUserId: BOARD_SUPA,
  fullName: 'Diretora Teste',
  status: 'ATIVO',
  primeiroAcesso: false,
  roles: ['BOARD'],
  phone: null,
  fullAddress: null,
};

vi.mock('@/modules/identity', () => ({
  getCurrentPerson: vi.fn(async () => mockOperator),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { reactivatePerson } = await import('../actions/reactivate-person');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('reactivatePerson — integração', () => {
  const createdIds: string[] = [];

  function asBoard() {
    mockOperator = {
      id: BOARD_ID,
      supabaseUserId: BOARD_SUPA,
      fullName: 'Diretora Teste',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles: ['BOARD'],
      phone: null,
      fullAddress: null,
    };
  }

  function asCoordinator(id = COORD_ID) {
    mockOperator = {
      id,
      supabaseUserId: id.replace('-000001', '-000002'),
      fullName: 'Coordenador Teste',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles: ['COORDINATOR'],
      phone: null,
      fullAddress: null,
    };
  }

  /** Cria uma Pessoa INATIVA, opcionalmente com grants ACTIVE e consentimento. */
  async function makeInactivePerson(opts: {
    inactivatedById?: string;
    roles?: string[];
    withConsent?: boolean;
  } = {}): Promise<string> {
    const id = crypto.randomUUID();
    const { inactivatedById = BOARD_ID, roles = [], withConsent = false } = opts;

    await prisma.person.create({
      data: {
        id,
        fullName: 'Pessoa Alvo',
        status: 'INATIVO',
        inactivatedAt: new Date(),
        inactivatedByPersonId: inactivatedById,
        inactivationReason: 'Inativação de teste.',
        roleGrants: {
          create: roles.map((role) => ({
            role: role as never,
            status: 'ACTIVE',
          })),
        },
        ...(withConsent
          ? {
              consents: {
                create: {
                  purpose: 'PORTAL_ACCESS',
                  termVersion: 'portal-access@v1.0',
                  termContentHash: 'hash-teste-reactivation',
                },
              },
            }
          : {}),
      },
      select: { id: true },
    });
    createdIds.push(id);
    return id;
  }

  /** Garante que o operador BOARD existe no DB (para `inactivatedByPersonId` ser FK válida). */
  async function ensureBoardExists() {
    const exists = await prisma.person.findUnique({ where: { id: BOARD_ID }, select: { id: true } });
    if (!exists) {
      await prisma.person.create({
        data: {
          id: BOARD_ID,
          fullName: 'Diretora Teste',
          status: 'ATIVO',
          roleGrants: { create: [{ role: 'BOARD' as never, status: 'ACTIVE' }] },
        },
        select: { id: true },
      });
      createdIds.push(BOARD_ID);
    }
  }

  afterEach(async () => {
    for (const id of createdIds) {
      await prisma.consent.deleteMany({ where: { personId: id } });
      await prisma.personRoleGrant.deleteMany({ where: { personId: id } });
      await prisma.person.deleteMany({ where: { id } });
      // auditLog não é limpo: a tabela é append-only por design (ADR-0023 /
      // REVOKE DELETE no DB). Não causa flakiness porque cada targetId é um
      // UUID novo gerado por crypto.randomUUID() em cada teste.
    }
    createdIds.length = 0;
    asBoard();
  });

  it('happy path (diretoria): flipa para ATIVO, limpa metadados de inativação e audita (E-001/L-003)', async () => {
    await ensureBoardExists();
    const targetId = await makeInactivePerson({ inactivatedById: BOARD_ID });

    const result = await reactivatePerson({
      personId: targetId,
      reason: 'Reativação do voluntário — inativação por engano.',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('ATIVO');

    const person = await prisma.person.findUnique({ where: { id: targetId } });
    expect(person?.status).toBe('ATIVO');
    // Metadados de inativação limpos.
    expect(person?.inactivatedAt).toBeNull();
    expect(person?.inactivatedByPersonId).toBeNull();
    expect(person?.inactivationReason).toBeNull();

    // L-003: auditoria imutável com responsável, motivo e entidade.
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'PERSON_REACTIVATED', entityId: targetId },
      orderBy: { occurredAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorPersonId).toBe(BOARD_ID);
    expect(audit?.justification).toBe('Reativação do voluntário — inativação por engano.');
    expect((audit?.after as Record<string, unknown> | null)?.status).toBe('ATIVO');
  });

  it('E-003/P-001: grants ATIVOS são zerados na mesma transação (decisão central — evita F1)', async () => {
    await ensureBoardExists();
    const targetId = await makeInactivePerson({
      inactivatedById: BOARD_ID,
      roles: ['VOLUNTEER', 'COORDINATOR'],
    });

    // Confirma: 2 grants ACTIVE antes da reativação.
    const before = await prisma.personRoleGrant.count({
      where: { personId: targetId, status: 'ACTIVE' },
    });
    expect(before).toBe(2);

    const result = await reactivatePerson({
      personId: targetId,
      reason: 'Reativação com grants existentes.',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.grantsRevoked).toBe(2);

    // Grants ACTIVE zerados — nenhum restou (P-001: sem restauração automática).
    const activeAfter = await prisma.personRoleGrant.count({
      where: { personId: targetId, status: 'ACTIVE' },
    });
    expect(activeAfter).toBe(0);

    // Grants foram marcados como REVOKED (append-only — não deletados).
    const revokedAfter = await prisma.personRoleGrant.count({
      where: { personId: targetId, status: 'REVOKED' },
    });
    expect(revokedAfter).toBe(2);
  });

  it('P-003: consentimentos NÃO são tocados pela reativação (ADR-0025 — re-aceite do titular)', async () => {
    await ensureBoardExists();
    const targetId = await makeInactivePerson({ inactivatedById: BOARD_ID, withConsent: true });

    const result = await reactivatePerson({
      personId: targetId,
      reason: 'Reativação preservando histórico de consentimentos.',
    });
    expect(result.ok).toBe(true);

    // Consentimento permanece exatamente como estava (não reinstaurado, não apagado).
    const consent = await prisma.consent.findFirst({ where: { personId: targetId } });
    expect(consent).not.toBeNull();
    expect(consent?.revokedAt).toBeNull();
  });

  it('P-002: coordenador NÃO reativa Pessoa inativada por BOARD (rank insuficiente)', async () => {
    await ensureBoardExists();
    // Inativado pelo BOARD — só outro BOARD pode reativar.
    const targetId = await makeInactivePerson({ inactivatedById: BOARD_ID });
    asCoordinator();

    const result = await reactivatePerson({
      personId: targetId,
      reason: 'Tentativa de coordenador reativar o que BOARD inativou.',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('FORBIDDEN');

    // Pessoa continua INATIVA.
    const person = await prisma.person.findUnique({ where: { id: targetId } });
    expect(person?.status).toBe('INATIVO');
  });

  it('coordenador reativa Pessoa inativada por outro coordenador (rank igual — OK)', async () => {
    // Cria um coordenador que "inativou" a Pessoa.
    const coordInactivatorId = 'dddddddd-1111-4111-8111-000000000001';
    const coordInactivatorExists = await prisma.person.findUnique({
      where: { id: coordInactivatorId },
      select: { id: true },
    });
    if (!coordInactivatorExists) {
      await prisma.person.create({
        data: {
          id: coordInactivatorId,
          fullName: 'Coordenador Inativador',
          status: 'ATIVO',
          roleGrants: { create: [{ role: 'COORDINATOR' as never, status: 'ACTIVE' }] },
        },
        select: { id: true },
      });
      createdIds.push(coordInactivatorId);
    }

    const targetId = await makeInactivePerson({ inactivatedById: coordInactivatorId });
    asCoordinator();

    const result = await reactivatePerson({
      personId: targetId,
      reason: 'Coordenador reativando o que outro coordenador inativou.',
    });
    expect(result.ok).toBe(true);
    const person = await prisma.person.findUnique({ where: { id: targetId } });
    expect(person?.status).toBe('ATIVO');
  });

  it('idempotência: Pessoa já ativa recebe CONFLICT', async () => {
    const activeId = crypto.randomUUID();
    await prisma.person.create({
      data: { id: activeId, fullName: 'Pessoa Ativa', status: 'ATIVO' },
      select: { id: true },
    });
    createdIds.push(activeId);

    const result = await reactivatePerson({
      personId: activeId,
      reason: 'Tentativa em Pessoa já ativa.',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CONFLICT');
  });

  it('concorrência (duplo submit simultâneo): só uma reativação vence, a outra CONFLICT', async () => {
    await ensureBoardExists();
    const targetId = await makeInactivePerson({ inactivatedById: BOARD_ID });

    const [a, b] = await Promise.all([
      reactivatePerson({ personId: targetId, reason: 'Reativação concorrente A.' }),
      reactivatePerson({ personId: targetId, reason: 'Reativação concorrente B.' }),
    ]);

    const oks = [a, b].filter((r) => r.ok);
    const fails = [a, b].filter((r) => !r.ok);
    expect(oks).toHaveLength(1);
    expect(fails).toHaveLength(1);
    const loser = fails[0];
    if (loser && !loser.ok) {
      expect(loser.error.code).toBe('CONFLICT');
    }

    const person = await prisma.person.findUnique({ where: { id: targetId } });
    expect(person?.status).toBe('ATIVO');

    // Exatamente um registro de auditoria (L-003).
    const audits = await prisma.auditLog.count({
      where: { action: 'PERSON_REACTIVATED', entityId: targetId },
    });
    expect(audits).toBe(1);
  });

  it('Pessoa inexistente recebe NOT_FOUND', async () => {
    const result = await reactivatePerson({
      personId: '99999999-9999-4999-8999-999999999999',
      reason: 'Alvo inexistente.',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });

  it('não autenticado: getCurrentPerson nulo recebe UNAUTHENTICATED', async () => {
    await ensureBoardExists();
    const targetId = await makeInactivePerson({ inactivatedById: BOARD_ID });
    mockOperator = null;

    const result = await reactivatePerson({
      personId: targetId,
      reason: 'Sem sessão válida.',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNAUTHENTICATED');
  });

  it('papel sem privilégio recebe FORBIDDEN (NOT_AUTHORIZED)', async () => {
    await ensureBoardExists();
    const targetId = await makeInactivePerson({ inactivatedById: BOARD_ID });
    mockOperator = {
      id: 'eeeeeeee-1111-4111-8111-000000000001',
      supabaseUserId: 'eeeeeeee-1111-4111-8111-000000000002',
      fullName: 'Candidato Teste',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles: ['CANDIDATE'],
      phone: null,
      fullAddress: null,
    };

    const result = await reactivatePerson({
      personId: targetId,
      reason: 'Candidato tentando reativar.',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('FORBIDDEN');
  });

  it('Zod: motivo ausente/curto retorna VALIDATION sem tocar o banco', async () => {
    await ensureBoardExists();
    const targetId = await makeInactivePerson({ inactivatedById: BOARD_ID });

    const result = await reactivatePerson({ personId: targetId, reason: 'x' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');

    const person = await prisma.person.findUnique({ where: { id: targetId } });
    expect(person?.status).toBe('INATIVO');
  });
});
