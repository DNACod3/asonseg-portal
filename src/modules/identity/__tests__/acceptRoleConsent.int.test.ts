import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';

/**
 * Testes de integração para a Server Action acceptRoleConsent (TX2).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Invariante crítica (ADR-0020 / P-002): o grant NUNCA chega a ACTIVE sem o
 * consent da finalidade estar persistido NA MESMA transação.
 */

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(
    new Headers({ 'x-real-ip': '10.0.0.2', 'user-agent': 'vitest/int-tx2' }),
  ),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { acceptRoleConsent } = await import('@/modules/identity');

const TERM_VERSION = 'job-application@v1.0';
const TERM_HASH = 'cba5ec9a519b6c5d2beab0adaf693252c87d95a9353877b9f3c43d41dfb064dd';

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('acceptRoleConsent — integração TX2', () => {
  let personId: string;
  let grantId: string;

  /** Insere um Person + grant AWAITING_CONSENT para cada teste. */
  async function createTestPerson(opts: { role?: 'CANDIDATE' | 'PROVIDER' | 'CLIENT' } = {}) {
    const role = opts.role ?? 'CANDIDATE';
    const id = crypto.randomUUID();
    const gId = crypto.randomUUID();

    await prisma.person.create({
      data: {
        id,
        fullName: 'Pessoa Teste TX2',
        cpf: null,
        emailLogin: `tx2-${id.slice(0, 8)}@example.com`,
        supabaseUserId: crypto.randomUUID(),
      },
    });

    await prisma.personRoleGrant.create({
      data: {
        id: gId,
        personId: id,
        role,
        status: 'AWAITING_CONSENT',
      },
    });

    return { id, gId };
  }

  beforeEach(async () => {
    const { id, gId } = await createTestPerson();
    personId = id;
    grantId = gId;
  });

  afterEach(async () => {
    // Limpa dados do teste na ordem correta (FK). O `audit_log` é append-only
    // (ADR-T-0004): não se apaga e não há FK p/ person — deletá-lo aborta a
    // cascata e deixa Person órfã no banco entre runs (issue #247).
    await prisma.consent.deleteMany({ where: { personId } });
    await prisma.personRoleGrant.deleteMany({ where: { personId } });
    await prisma.person.deleteMany({ where: { id: personId } });
  });

  it('happy path (P-002): ativa grant e cria consent na mesma transação', async () => {
    const result = await acceptRoleConsent({
      personId,
      role: 'CANDIDATE',
      termVersion: TERM_VERSION,
      termContentHash: TERM_HASH,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.activated).toBe(true);
    expect(result.data.personId).toBe(personId);

    // Grant deve estar ACTIVE.
    const grant = await prisma.personRoleGrant.findUnique({ where: { id: grantId } });
    expect(grant?.status).toBe('ACTIVE');

    // Consent da finalidade deve existir.
    const consent = await prisma.consent.findFirst({
      where: { personId, purpose: 'JOB_APPLICATION' },
    });
    expect(consent).not.toBeNull();
    expect(consent?.termVersion).toBe(TERM_VERSION);
    expect(consent?.revokedAt).toBeNull();
  });

  it('Zod: personId inválido (não UUID) retorna VALIDATION', async () => {
    const result = await acceptRoleConsent({
      personId: 'not-a-uuid',
      role: 'CANDIDATE',
      termVersion: TERM_VERSION,
      termContentHash: TERM_HASH,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });

  it('GRANT_NOT_FOUND: grant inexistente retorna NOT_FOUND', async () => {
    const result = await acceptRoleConsent({
      personId: crypto.randomUUID(), // UUID válido mas sem Person/grant
      role: 'CANDIDATE',
      termVersion: TERM_VERSION,
      termContentHash: TERM_HASH,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });

  it('idempotência: segunda chamada retorna NOT_FOUND (grant já ACTIVE)', async () => {
    const first = await acceptRoleConsent({
      personId,
      role: 'CANDIDATE',
      termVersion: TERM_VERSION,
      termContentHash: TERM_HASH,
    });
    expect(first.ok).toBe(true);

    // Segunda chamada — grant já está ACTIVE, não AWAITING_CONSENT.
    const second = await acceptRoleConsent({
      personId,
      role: 'CANDIDATE',
      termVersion: TERM_VERSION,
      termContentHash: TERM_HASH,
    });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('NOT_FOUND');
  });

  it('mapeamento de papel: PROVIDER cria consent SERVICE_OFFERING', async () => {
    // Cria Person/grant específicos para PROVIDER.
    const { id: pId } = await createTestPerson({ role: 'PROVIDER' });

    const result = await acceptRoleConsent({
      personId: pId,
      role: 'PROVIDER',
      termVersion: 'service-offering@v1.0',
      termContentHash: '9abdc14dbe425e0422987d5b5fc6002f942b90ac053c5d6a9b423640907a88a7',
    });

    expect(result.ok).toBe(true);

    const consent = await prisma.consent.findFirst({
      where: { personId: pId, purpose: 'SERVICE_OFFERING' },
    });
    expect(consent).not.toBeNull();

    // Cleanup extra (audit_log fica — append-only, ADR-T-0004; ver afterEach).
    await prisma.consent.deleteMany({ where: { personId: pId } });
    await prisma.personRoleGrant.deleteMany({ where: { personId: pId } });
    await prisma.person.deleteMany({ where: { id: pId } });
  });
});
