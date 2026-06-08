import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

/**
 * Integração de grant/revoke de permissões delegadas (USP-008).
 * Requer Postgres local (`supabase start`) + DATABASE_URL.
 * `getCurrentPerson` é mockado — não há sessão Supabase no teste.
 */

const sessionState = vi.hoisted(() => ({
  person: null as null | {
    id: string;
    supabaseUserId: string;
    fullName: string;
    status: 'ATIVO';
    primeiroAcesso: boolean;
    roles: string[];
    phone: string | null;
    fullAddress: string | null;
  },
}));

vi.mock('../server/session', () => ({
  getCurrentPerson: async () => sessionState.person,
}));

const { prisma } = await import('@/shared/lib/prisma');
const { grantDelegatedPermission } = await import('../actions/grant-delegated-permission');
const { revokeDelegatedPermission } = await import('../actions/revoke-delegated-permission');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

async function seedPerson(roles: string[] = []) {
  const id = crypto.randomUUID();
  await prisma.person.create({
    data: {
      id,
      fullName: `Pessoa-${id.slice(0, 8)}`,
      emailLogin: `test-${id.slice(0, 8)}@example.com`,
      supabaseUserId: crypto.randomUUID(),
    },
  });
  for (const role of roles) {
    await prisma.personRoleGrant.create({
      data: { personId: id, role: role as Parameters<typeof prisma.personRoleGrant.create>[0]['data']['role'], status: 'ACTIVE' },
    });
  }
  return id;
}

function asSession(id: string, roles: string[]) {
  sessionState.person = {
    id,
    supabaseUserId: crypto.randomUUID(),
    fullName: 'Teste',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles,
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('grantDelegatedPermission — integração', () => {
  let coordinatorId: string;
  let volunteerId: string;

  beforeEach(async () => {
    coordinatorId = await seedPerson(['COORDINATOR']);
    volunteerId = await seedPerson(['VOLUNTEER']);
  });

  it('concede permissão e aplica imediatamente', async () => {
    asSession(coordinatorId, ['COORDINATOR']);
    const result = await grantDelegatedPermission({
      targetPersonId: volunteerId,
      permission: 'MODERATE_JOB',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const grant = await prisma.delegatedPermission.findUnique({
      where: { id: result.data.permissionId },
    });
    expect(grant).not.toBeNull();
    expect(grant?.permission).toBe('MODERATE_JOB');
    expect(grant?.revokedAt).toBeNull();
  });

  it('registra log de auditoria', async () => {
    asSession(coordinatorId, ['COORDINATOR']);
    const result = await grantDelegatedPermission({
      targetPersonId: volunteerId,
      permission: 'MODERATE_CV',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const log = await prisma.auditLog.findFirst({
      where: { entityId: result.data.permissionId, action: 'DELEGATED_PERMISSION_GRANTED' },
      select: { actorPersonId: true, after: true },
    });
    expect(log).not.toBeNull();
    expect(log?.actorPersonId).toBe(coordinatorId);
  });

  it('rejeita não-coordenador com FORBIDDEN', async () => {
    asSession(volunteerId, ['VOLUNTEER']);
    const result = await grantDelegatedPermission({
      targetPersonId: coordinatorId,
      permission: 'MODERATE_JOB',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('FORBIDDEN');
  });

  it('rejeita alvo inexistente com NOT_FOUND', async () => {
    asSession(coordinatorId, ['COORDINATOR']);
    const result = await grantDelegatedPermission({
      targetPersonId: crypto.randomUUID(),
      permission: 'MODERATE_JOB',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });

  it('rejeita alvo inativo com PRECONDITION_FAILED', async () => {
    asSession(coordinatorId, ['COORDINATOR']);
    await prisma.person.update({
      where: { id: volunteerId },
      data: { status: 'INATIVO' },
    });

    const result = await grantDelegatedPermission({
      targetPersonId: volunteerId,
      permission: 'MODERATE_JOB',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PRECONDITION_FAILED');

    // Não deve ter criado nenhum grant para o alvo inativo.
    const grants = await prisma.delegatedPermission.findMany({
      where: { personId: volunteerId },
    });
    expect(grants).toHaveLength(0);
  });

  it('rejeita entrada inválida com VALIDATION (Zod)', async () => {
    asSession(coordinatorId, ['COORDINATOR']);
    const result = await grantDelegatedPermission({
      targetPersonId: 'não-é-uuid',
      permission: 'PERMISSAO_INEXISTENTE' as 'MODERATE_JOB',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });
});

skipIfNoDb('revokeDelegatedPermission — integração', () => {
  let coordinatorId: string;
  let volunteerId: string;

  beforeEach(async () => {
    coordinatorId = await seedPerson(['COORDINATOR']);
    volunteerId = await seedPerson(['VOLUNTEER']);
  });

  it('revoga permissão e preenche revokedAt', async () => {
    asSession(coordinatorId, ['COORDINATOR']);

    // Concede primeiro
    const granted = await grantDelegatedPermission({
      targetPersonId: volunteerId,
      permission: 'MODERATE_JOB',
    });
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;

    const revokeResult = await revokeDelegatedPermission({
      permissionGrantId: granted.data.permissionId,
      justification: 'Voluntário saiu da área de moderação',
    });
    expect(revokeResult.ok).toBe(true);

    const grant = await prisma.delegatedPermission.findUnique({
      where: { id: granted.data.permissionId },
    });
    expect(grant?.revokedAt).not.toBeNull();
    expect(grant?.revokedBy).toBe(coordinatorId);
  });

  it('não deleta o registro (append-only)', async () => {
    asSession(coordinatorId, ['COORDINATOR']);
    const granted = await grantDelegatedPermission({
      targetPersonId: volunteerId,
      permission: 'MODERATE_SERVICE',
    });
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;

    await revokeDelegatedPermission({
      permissionGrantId: granted.data.permissionId,
      justification: 'Teste de append-only',
    });

    const grant = await prisma.delegatedPermission.findUnique({
      where: { id: granted.data.permissionId },
    });
    expect(grant).not.toBeNull();
  });

  it('rejeita revogação duplicada com CONFLICT', async () => {
    asSession(coordinatorId, ['COORDINATOR']);
    const granted = await grantDelegatedPermission({
      targetPersonId: volunteerId,
      permission: 'MODERATE_JOB',
    });
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;

    await revokeDelegatedPermission({
      permissionGrantId: granted.data.permissionId,
      justification: 'Primeira revogação OK',
    });

    const second = await revokeDelegatedPermission({
      permissionGrantId: granted.data.permissionId,
      justification: 'Tentativa duplicada',
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('CONFLICT');
  });

  it('rejeita sem sessão com UNAUTHENTICATED', async () => {
    sessionState.person = null;
    const result = await revokeDelegatedPermission({
      permissionGrantId: crypto.randomUUID(),
      justification: 'Qualquer motivo aqui',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejeita justificativa curta com VALIDATION (Zod)', async () => {
    asSession(coordinatorId, ['COORDINATOR']);
    const result = await revokeDelegatedPermission({
      permissionGrantId: crypto.randomUUID(),
      justification: 'curta', // < 10 caracteres
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });

  it('duplo submit simultâneo: apenas um vence, o outro vira CONFLICT', async () => {
    asSession(coordinatorId, ['COORDINATOR']);
    const granted = await grantDelegatedPermission({
      targetPersonId: volunteerId,
      permission: 'MODERATE_JOB',
    });
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;

    // Dispara duas revogações concorrentes sobre o mesmo grant.
    const [a, b] = await Promise.all([
      revokeDelegatedPermission({
        permissionGrantId: granted.data.permissionId,
        justification: 'Revogação concorrente A',
      }),
      revokeDelegatedPermission({
        permissionGrantId: granted.data.permissionId,
        justification: 'Revogação concorrente B',
      }),
    ]);

    const oks = [a, b].filter((r) => r.ok);
    const conflicts = [a, b].filter((r) => !r.ok && r.error.code === 'CONFLICT');
    expect(oks).toHaveLength(1);
    expect(conflicts).toHaveLength(1);

    // Apenas uma revogação efetiva — revokedBy preenchido uma única vez.
    const grant = await prisma.delegatedPermission.findUnique({
      where: { id: granted.data.permissionId },
    });
    expect(grant?.revokedAt).not.toBeNull();
    expect(grant?.revokedBy).toBe(coordinatorId);
  });
});
