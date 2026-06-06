import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'node:crypto';

/**
 * Teste de integração leve do model `CredentialClaim` (USP-003 / sub-task #59).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Valida apenas o contrato do model/migration: uma reivindicação nasce PENDING,
 * vinculada a uma Pessoa existente (P-002 — não cria Pessoa nova), com os
 * defaults corretos (`status`, `requestedAt`) e os campos de verificação nulos.
 */

const { prisma } = await import('@/shared/lib/prisma');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('CredentialClaim — model (integração leve)', () => {
  const createdPersonIds: string[] = [];

  afterEach(async () => {
    // Cascade onDelete remove os claims junto com a Pessoa.
    for (const id of createdPersonIds) {
      await prisma.person.deleteMany({ where: { id } });
    }
    createdPersonIds.length = 0;
  });

  it('cria claim PENDING vinculada a uma Pessoa pré-existente, com defaults corretos', async () => {
    // Pessoa pré-cadastrada (USP-002): sem credencial.
    const person = await prisma.person.create({
      data: { id: crypto.randomUUID(), fullName: 'Pessoa Pré-cadastrada' },
      select: { id: true },
    });
    createdPersonIds.push(person.id);

    const claim = await prisma.credentialClaim.create({
      data: {
        personId: person.id,
        requestedEmail: 'reivindica@example.com',
        verificationMethod: 'AS_CONFIRMATION',
      },
    });

    expect(claim.id).toBeTruthy();
    expect(claim.personId).toBe(person.id);
    expect(claim.requestedEmail).toBe('reivindica@example.com');
    expect(claim.verificationMethod).toBe('AS_CONFIRMATION');
    // Default do ciclo de vida.
    expect(claim.status).toBe('PENDING');
    expect(claim.verifiedByPersonId).toBeNull();
    expect(claim.verifiedAt).toBeNull();
    expect(claim.rejectedReason).toBeNull();
    expect(claim.requestedAt).toBeInstanceOf(Date);
  });
});
