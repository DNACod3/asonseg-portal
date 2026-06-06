import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';

/**
 * Integração de `activateAdditionalRole` (USP-006). Requer Postgres local
 * (`supabase start`) + DATABASE_URL. Valida a transação real: grant + consent +
 * auditoria numa única transação (ADR-0020 / P-001) e a persistência dos campos
 * faltantes do perfil (E-001). `getCurrentPerson` é mockado (não há sessão
 * Supabase no teste) — a action ainda opera só sobre o `id` retornado (P-002).
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

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(
    new Headers({ 'x-real-ip': '10.0.0.3', 'user-agent': 'vitest/int-usp006' }),
  ),
}));

vi.mock('../server/session', () => ({
  getCurrentPerson: async () => sessionState.person,
}));

const { prisma } = await import('@/shared/lib/prisma');
const { activateAdditionalRole } = await import('../actions/activate-additional-role');

// Termo vigente de SERVICE_OFFERING. A action recarrega e valida o termo
// server-side (P-004); este aceite tem de bater com a versão/hash vigentes do
// registro (`legal/consent-terms/<slug>/v1.0.md`) — senão a checagem otimista
// rejeita com CONFLICT.
const SERVICE_TERM = { version: 'v1.0', hash: '9abdc14dbe425e0422987d5b5fc6002f942b90ac053c5d6a9b423640907a88a7' };

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('activateAdditionalRole — integração (Supabase local)', () => {
  let personId: string;

  /** Cria Person + um grant CANDIDATE ACTIVE (cenário "papel adicional"). */
  async function seedPerson(opts: { phone?: string | null; fullAddress?: string | null } = {}) {
    const id = crypto.randomUUID();
    await prisma.person.create({
      data: {
        id,
        fullName: 'Pessoa USP-006',
        emailLogin: `usp006-${id.slice(0, 8)}@example.com`,
        supabaseUserId: crypto.randomUUID(),
        phone: opts.phone === undefined ? '11999990000' : opts.phone,
        fullAddress: opts.fullAddress === undefined ? 'Rua X, 123' : opts.fullAddress,
      },
    });
    await prisma.personRoleGrant.create({
      data: { personId: id, role: 'CANDIDATE', status: 'ACTIVE' },
    });
    return id;
  }

  function asSession(
    id: string,
    roles: string[],
    profile: { phone?: string | null; fullAddress?: string | null } = {},
  ) {
    // `getCurrentPerson` (mockado) já traz o perfil mínimo: a action decide os
    // campos faltantes (E-001) a partir da sessão, sem reler a Pessoa do banco.
    sessionState.person = {
      id,
      supabaseUserId: crypto.randomUUID(),
      fullName: 'Pessoa USP-006',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles,
      phone: profile.phone === undefined ? '11999990000' : profile.phone,
      fullAddress: profile.fullAddress === undefined ? 'Rua X, 123' : profile.fullAddress,
    };
  }

  beforeEach(async () => {
    personId = await seedPerson();
    asSession(personId, ['CANDIDATE']);
  });

  afterEach(async () => {
    // FK order; audit_log é append-only (não se apaga — ADR-T-0004).
    await prisma.consent.deleteMany({ where: { personId } });
    await prisma.personRoleGrant.deleteMany({ where: { personId } });
    await prisma.person.deleteMany({ where: { id: personId } });
  });

  it('happy path (P-001): ativa PROVIDER com grant ACTIVE + consent SERVICE_OFFERING na mesma transação', async () => {
    const result = await activateAdditionalRole({
      role: 'PROVIDER',
      termVersion: SERVICE_TERM.version,
      termContentHash: SERVICE_TERM.hash,
      acceptTerm: true,
      profile: {},
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ role: 'PROVIDER', status: 'ACTIVE' });

    const grant = await prisma.personRoleGrant.findFirst({
      where: { personId, role: 'PROVIDER' },
    });
    expect(grant?.status).toBe('ACTIVE');

    const consent = await prisma.consent.findFirst({
      where: { personId, purpose: 'SERVICE_OFFERING', revokedAt: null },
    });
    expect(consent).not.toBeNull();
    expect(consent?.termVersion).toBe('v1.0');

    // Log do papel ativado (AC: "DEVE registrar log do papel ativado").
    const audit = await prisma.auditLog.findFirst({
      where: { actorPersonId: personId, action: 'ROLE_GRANT_ACTIVATED', entityType: 'person_role_grant' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(audit).not.toBeNull();
  });

  it('idempotência: ativar papel já ativo retorna CONFLICT', async () => {
    const first = await activateAdditionalRole({
      role: 'PROVIDER',
      termVersion: SERVICE_TERM.version,
      termContentHash: SERVICE_TERM.hash,
      acceptTerm: true,
      profile: {},
    });
    expect(first.ok).toBe(true);

    asSession(personId, ['CANDIDATE', 'PROVIDER']); // papel agora ativo
    const second = await activateAdditionalRole({
      role: 'PROVIDER',
      termVersion: SERVICE_TERM.version,
      termContentHash: SERVICE_TERM.hash,
      acceptTerm: true,
      profile: {},
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('CONFLICT');
  });

  it('campo faltante: exige e persiste o telefone ausente (E-001)', async () => {
    // Person sem telefone; tenta ativar PROVIDER (exige phone + fullAddress).
    const noPhoneId = await seedPerson({ phone: null });
    asSession(noPhoneId, ['CANDIDATE'], { phone: null });

    const missing = await activateAdditionalRole({
      role: 'PROVIDER',
      termVersion: SERVICE_TERM.version,
      termContentHash: SERVICE_TERM.hash,
      acceptTerm: true,
      profile: {},
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.fieldErrors?.['profile.phone']).toBeTruthy();

    const filled = await activateAdditionalRole({
      role: 'PROVIDER',
      termVersion: SERVICE_TERM.version,
      termContentHash: SERVICE_TERM.hash,
      acceptTerm: true,
      profile: { phone: '11977776666' },
    });
    expect(filled.ok).toBe(true);

    const person = await prisma.person.findUnique({ where: { id: noPhoneId }, select: { phone: true } });
    expect(person?.phone).toBe('11977776666');

    // Cleanup do segundo person.
    await prisma.consent.deleteMany({ where: { personId: noPhoneId } });
    await prisma.personRoleGrant.deleteMany({ where: { personId: noPhoneId } });
    await prisma.person.deleteMany({ where: { id: noPhoneId } });
  });

  it('reaproveita consent SERVICE_OFFERING já ativo: não cria 2º consent e ativa o papel', async () => {
    // Pré-condição rara (pós-cascata): já existe consent ativo da finalidade.
    await prisma.consent.create({
      data: {
        id: crypto.randomUUID(),
        personId,
        purpose: 'SERVICE_OFFERING',
        termVersion: SERVICE_TERM.version,
        termContentHash: SERVICE_TERM.hash,
      },
    });

    const result = await activateAdditionalRole({
      role: 'PROVIDER',
      termVersion: SERVICE_TERM.version,
      termContentHash: SERVICE_TERM.hash,
      acceptTerm: true,
      profile: {},
    });

    expect(result.ok).toBe(true);

    // O índice único parcial garante no máximo um consent ativo por finalidade —
    // a action reaproveitou o existente em vez de criar um segundo.
    const consents = await prisma.consent.findMany({
      where: { personId, purpose: 'SERVICE_OFFERING', revokedAt: null },
      take: 10,
    });
    expect(consents).toHaveLength(1);

    const grant = await prisma.personRoleGrant.findFirst({ where: { personId, role: 'PROVIDER' } });
    expect(grant?.status).toBe('ACTIVE');
  });
});
