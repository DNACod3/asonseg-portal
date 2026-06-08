import { describe, it, expect, vi, afterEach } from 'vitest';
import crypto from 'node:crypto';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração da Server Action inactivatePerson (USP-007 / #84).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Mocks: next/headers (IP/UA) e @/modules/identity (operador autenticado).
 * Real: Prisma/Postgres + container (port de Empresa) — valida o flip de status
 * (E-001), preservação de histórico (E-002 / P-003 / P-005), bloqueio de único
 * responsável (E-003 / P-002), autorização (E-001) e auditoria imutável (L-004).
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest/int' })),
}));

const BOARD_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const BOARD_SUPA = 'aaaaaaaa-0000-4000-8000-000000000002';

// Operador mutável por teste (default: diretoria ativa).
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
const { container } = await import('@/shared/container');
const { inactivatePerson } = await import('../actions/inactivate-person');
const { COMPANY_RESPONSIBILITY_TOKEN } = await import('../ports/companyResponsibility');
const { NullCompanyResponsibilityAdapter } = await import('../adapters/null-company-responsibility');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('inactivatePerson — integração', () => {
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

  /** Cria uma Pessoa de teste (sem credencial) com papéis ativos opcionais. */
  async function makePerson(roles: string[] = []): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.person.create({
      data: {
        id,
        fullName: 'Pessoa Alvo',
        status: 'ATIVO',
        roleGrants: { create: roles.map((role) => ({ role: role as never, status: 'ACTIVE' })) },
      },
      select: { id: true },
    });
    createdIds.push(id);
    return id;
  }

  afterEach(async () => {
    for (const id of createdIds) {
      await prisma.consent.deleteMany({ where: { personId: id } });
      await prisma.personRoleGrant.deleteMany({ where: { personId: id } });
      await prisma.person.deleteMany({ where: { id } });
    }
    createdIds.length = 0;
    asBoard();
    // Restaura o binding de produção (adapter nulo) após eventuais overrides.
    container.register(COMPANY_RESPONSIBILITY_TOKEN, () => new NullCompanyResponsibilityAdapter());
  });

  it('happy path (diretoria): flipa para INATIVO, carimba metadados e audita (E-001/L-004)', async () => {
    const targetId = await makePerson(['CANDIDATE']);

    const result = await inactivatePerson({
      personId: targetId,
      reason: 'Desligamento a pedido do titular.',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('INATIVO');

    const person = await prisma.person.findUnique({ where: { id: targetId } });
    expect(person?.status).toBe('INATIVO');
    expect(person?.inactivatedAt).not.toBeNull();
    expect(person?.inactivatedByPersonId).toBe(BOARD_ID);
    expect(person?.inactivationReason).toBe('Desligamento a pedido do titular.');

    // L-004: auditoria imutável com responsável, motivo e entidade.
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'PERSON_INACTIVATED', entityId: targetId },
      orderBy: { occurredAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorPersonId).toBe(BOARD_ID);
    expect(audit?.justification).toBe('Desligamento a pedido do titular.');
    expect((audit?.after as Record<string, unknown> | null)?.status).toBe('INATIVO');
  });

  it('E-002/P-003/P-005: histórico preservado — grant e consentimento permanecem após inativar', async () => {
    const targetId = await makePerson(['VOLUNTEER']);
    await prisma.consent.create({
      data: {
        personId: targetId,
        purpose: 'PORTAL_ACCESS',
        termVersion: 'portal-access@v1.0',
        termContentHash: 'hash-teste',
      },
    });

    const result = await inactivatePerson({ personId: targetId, reason: 'Encerramento de vínculo.' });
    expect(result.ok).toBe(true);

    // Nada apagado: grant e consentimento seguem no banco (ADR-0008).
    const grants = await prisma.personRoleGrant.count({ where: { personId: targetId } });
    expect(grants).toBe(1);
    const consents = await prisma.consent.count({ where: { personId: targetId } });
    expect(consents).toBe(1);
    // Consentimento NÃO é deletado nem "revogado" pela inativação (P-005).
    const consent = await prisma.consent.findFirst({ where: { personId: targetId } });
    expect(consent?.revokedAt).toBeNull();
  });

  it('E-003/P-002: único responsável de Empresa bloqueia — PRECONDITION_FAILED e Pessoa segue ATIVA', async () => {
    const targetId = await makePerson(['COMPANY_RESPONSIBLE']);
    // Override do port: simula o adapter real do módulo `companies`.
    container.register(COMPANY_RESPONSIBILITY_TOKEN, () => ({
      companiesLeftWithoutResponsible: async () => [
        { id: 'comp-1', name: 'Padaria do Zé' },
        { id: 'comp-2', name: 'Mercado Central' },
      ],
    }));

    const result = await inactivatePerson({ personId: targetId, reason: 'Saída do responsável.' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PRECONDITION_FAILED');
    expect(result.error.message).toContain('Padaria do Zé');
    expect(result.error.message).toContain('Mercado Central');

    // A inativação foi bloqueada ANTES de tocar o status (não corrige depois).
    const person = await prisma.person.findUnique({ where: { id: targetId } });
    expect(person?.status).toBe('ATIVO');
  });

  it('permissão (coordenador): inativa voluntário, mas NÃO um não-voluntário', async () => {
    mockOperator = {
      id: 'cccccccc-0000-4000-8000-000000000001',
      supabaseUserId: 'cccccccc-0000-4000-8000-000000000002',
      fullName: 'Coordenador Teste',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles: ['COORDINATOR'],
      phone: null,
      fullAddress: null,
    };

    const volunteer = await makePerson(['VOLUNTEER']);
    const okResult = await inactivatePerson({ personId: volunteer, reason: 'Fim do projeto social.' });
    expect(okResult.ok).toBe(true);

    const candidate = await makePerson(['CANDIDATE']);
    const denied = await inactivatePerson({ personId: candidate, reason: 'Tentativa fora do escopo.' });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error.code).toBe('FORBIDDEN');
    const stillActive = await prisma.person.findUnique({ where: { id: candidate } });
    expect(stillActive?.status).toBe('ATIVO');
  });

  it('self-inactivation: operador tentando inativar a si mesmo recebe FORBIDDEN', async () => {
    // Cria a Pessoa do próprio operador (id = BOARD_ID) para o alvo existir.
    await prisma.person.create({
      data: { id: BOARD_ID, fullName: 'Diretora Teste', status: 'ATIVO' },
      select: { id: true },
    });
    createdIds.push(BOARD_ID);

    const result = await inactivatePerson({ personId: BOARD_ID, reason: 'Tentativa de auto-inativação.' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('FORBIDDEN');
  });

  it('idempotência: Pessoa já inativa recebe CONFLICT', async () => {
    const targetId = await makePerson(['CANDIDATE']);
    const first = await inactivatePerson({ personId: targetId, reason: 'Primeira inativação.' });
    expect(first.ok).toBe(true);

    const second = await inactivatePerson({ personId: targetId, reason: 'Segunda tentativa.' });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('CONFLICT');
  });

  it('concorrência (duplo submit simultâneo): só uma inativação vence, a outra CONFLICT', async () => {
    const targetId = await makePerson(['CANDIDATE']);

    // Duas requests inativam ao mesmo tempo: ambas passam a pré-condição (leem
    // ATIVO) e entram na TX. O guard atômico (`updateMany WHERE status=ATIVO`)
    // garante que só uma transiciona — a perdedora casa 0 linhas → CONFLICT.
    const [a, b] = await Promise.all([
      inactivatePerson({ personId: targetId, reason: 'Inativação concorrente A.' }),
      inactivatePerson({ personId: targetId, reason: 'Inativação concorrente B.' }),
    ]);

    const oks = [a, b].filter((r) => r.ok);
    const fails = [a, b].filter((r) => !r.ok);
    expect(oks).toHaveLength(1);
    expect(fails).toHaveLength(1);
    const loser = fails[0];
    if (loser && !loser.ok) {
      expect(loser.error.code).toBe('CONFLICT');
    }

    // Exatamente uma transição e exatamente um registro de auditoria (L-004).
    const person = await prisma.person.findUnique({ where: { id: targetId } });
    expect(person?.status).toBe('INATIVO');
    const audits = await prisma.auditLog.count({
      where: { action: 'PERSON_INACTIVATED', entityId: targetId },
    });
    expect(audits).toBe(1);
  });

  it('Pessoa inexistente recebe NOT_FOUND', async () => {
    const result = await inactivatePerson({
      personId: '99999999-9999-4999-8999-999999999999',
      reason: 'Alvo inexistente.',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });

  it('não autenticado: getCurrentPerson nulo recebe UNAUTHENTICATED', async () => {
    const targetId = await makePerson(['CANDIDATE']);
    mockOperator = null;

    const result = await inactivatePerson({ personId: targetId, reason: 'Sem sessão válida.' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNAUTHENTICATED');
  });

  it('Zod: motivo ausente/curto retorna VALIDATION sem tocar o banco', async () => {
    const targetId = await makePerson(['CANDIDATE']);
    const result = await inactivatePerson({ personId: targetId, reason: 'x' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');

    const person = await prisma.person.findUnique({ where: { id: targetId } });
    expect(person?.status).toBe('ATIVO');
  });
});
