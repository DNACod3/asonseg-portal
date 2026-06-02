import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Prisma } from '@prisma/client';

/**
 * Integração contra o Postgres local (Supabase CLI). Valida o que os unit tests
 * não alcançam: o índice único parcial de consentimento ativo (H1/#37) e o
 * `requireActiveConsent` em queries reais. Pulado quando não há `DATABASE_URL`.
 */
const { prisma } = await import('@/shared/lib/prisma');
const { requireActiveConsent } = await import('../server/require-active-consent');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('consents — integração (Supabase local)', () => {
  let personId = '';

  beforeAll(async () => {
    const person = await prisma.person.create({
      data: { fullName: 'Consent Integração', status: 'ATIVO' },
      select: { id: true },
    });
    personId = person.id;
  });

  afterAll(async () => {
    await prisma.consent.deleteMany({ where: { personId } });
    await prisma.person.delete({ where: { id: personId } });
  });

  it('o índice parcial impede dois consentimentos ATIVOS na mesma finalidade', async () => {
    await prisma.consent.create({
      data: { personId, purpose: 'JOB_APPLICATION', termVersion: 'v1.0', termContentHash: 'h1' },
    });

    // Segundo ativo para a mesma finalidade ⇒ viola consents_active_purpose_unique.
    await expect(
      prisma.consent.create({
        data: { personId, purpose: 'JOB_APPLICATION', termVersion: 'v1.0', termContentHash: 'h2' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    expect(await requireActiveConsent(personId, 'JOB_APPLICATION', prisma)).toMatchObject({
      active: true,
    });
  });

  it('após revogar (revoked_at), um novo aceite ativo é permitido', async () => {
    await prisma.consent.updateMany({
      where: { personId, purpose: 'JOB_APPLICATION', revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'teste' },
    });

    // Revogado ⇒ requireActiveConsent não-ativo (REVOKED).
    expect(await requireActiveConsent(personId, 'JOB_APPLICATION', prisma)).toMatchObject({
      active: false,
      reason: 'REVOKED',
    });

    // Linha revogada saiu do índice parcial ⇒ novo aceite ativo entra sem P2002.
    const reentry = await prisma.consent.create({
      data: { personId, purpose: 'JOB_APPLICATION', termVersion: 'v1.0', termContentHash: 'h3' },
      select: { id: true },
    });
    expect(reentry.id).toBeTruthy();
    expect(await requireActiveConsent(personId, 'JOB_APPLICATION', prisma)).toMatchObject({
      active: true,
    });
  });

  it('finalidade sem aceite ⇒ ABSENT', async () => {
    expect(await requireActiveConsent(personId, 'SOCIAL_ASSISTANCE', prisma)).toEqual({
      active: false,
      reason: 'ABSENT',
    });
    // Garante que `Prisma` está disponível no escopo (lint/uso explícito).
    expect(Prisma.PrismaClientKnownRequestError).toBeTypeOf('function');
  });
});
