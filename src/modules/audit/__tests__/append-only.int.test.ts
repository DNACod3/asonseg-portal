import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { AuditEvent } from '@/modules/audit';

/**
 * Integração — a imutabilidade do `audit_log` (ADR-T-0004) vive no Postgres
 * (trigger BEFORE UPDATE/DELETE + REVOKE), não no TypeScript. Os testes
 * unitários mockam o Prisma; aqui validamos o comportamento real do banco:
 * INSERT permitido, UPDATE/DELETE bloqueados, e o único DELETE liberado pela
 * flag de sessão `app.audit_purge` (usada pelo job de retenção).
 *
 * Requer Postgres local (`supabase start`) + `.env.local`; ver
 * vitest.integration.config.ts. Sem DATABASE_URL, a suíte é pulada.
 */
const hasDb = !!process.env.DATABASE_URL;

// Marcador para isolar/limpar os registros criados por este teste.
const MARKER = '__audit_int_test__';

describe.skipIf(!hasDb)('audit_log append-only (integração)', () => {
  const prisma = new PrismaClient();
  let seededId: bigint;

  beforeAll(async () => {
    const row = await prisma.auditLog.create({
      data: { action: AuditEvent.JOB_PUBLISHED, context: { [MARKER]: true } },
      select: { id: true },
    });
    seededId = row.id;
  });

  afterAll(async () => {
    // Limpeza só é possível sob a flag de purge — mesma porta usada pela retenção.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL app.audit_purge = 'on'");
      await tx.$executeRawUnsafe(
        `DELETE FROM audit_log WHERE context ->> '${MARKER}' = 'true'`,
      );
    });
    await prisma.$disconnect();
  });

  it('permite INSERT', () => {
    expect(seededId).toBeDefined();
  });

  it('bloqueia UPDATE (trigger à prova de owner)', async () => {
    await expect(
      prisma.auditLog.update({
        where: { id: seededId },
        data: { justification: 'tentativa de adulteração' },
      }),
    ).rejects.toThrow(/append-only|UPDATE bloqueado/i);
  });

  it('bloqueia DELETE sem a flag de purge', async () => {
    await expect(prisma.auditLog.delete({ where: { id: seededId } })).rejects.toThrow(
      /append-only|DELETE bloqueado/i,
    );
    // Confirma que a linha continua lá após a tentativa barrada.
    const still = await prisma.auditLog.findUnique({ where: { id: seededId } });
    expect(still).not.toBeNull();
  });

  it('libera DELETE somente sob SET LOCAL app.audit_purge = on', async () => {
    const tmp = await prisma.auditLog.create({
      data: { action: AuditEvent.AUDIT_LOG_PURGED, context: { [MARKER]: true } },
      select: { id: true },
    });

    const removed = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL app.audit_purge = 'on'");
      const res = await tx.auditLog.deleteMany({ where: { id: tmp.id } });
      return res.count;
    });

    expect(removed).toBe(1);
    const gone = await prisma.auditLog.findUnique({ where: { id: tmp.id } });
    expect(gone).toBeNull();
  });
});
