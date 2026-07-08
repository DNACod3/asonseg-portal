import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `manifestInterest` (USP-033 / AC-033-1..5). Requer
 * Postgres local (`supabase start`) e `DATABASE_URL` no env. Cobre a matriz
 * obrigatória de Server Action (happy · outbox · Zod · unauth · not-found ·
 * pré-condição serviço/autor · self-service · consent-ausente ·
 * consent-ativo-sem-novo-aceite · duplicata sequencial · **concorrência**) e os
 * must-nots SVC033-MN-02 (sem consent → sem escrita, papel não ativado),
 * SVC033-MN-03 (unicidade ativa sob corrida), SVC033-MN-04 (auto-manifestação
 * bloqueada) e SVC033-MN-05 (serviço/autor não-elegível → sem escrita).
 */

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
  requireActivePerson: vi.fn(async () => mockPerson),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;

const { prisma } = await import('@/shared/lib/prisma');
const { manifestInterest } = await import('../actions/manifest-interest');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

function personOf(id: string, fullName: string): CurrentPerson {
  return {
    id,
    supabaseUserId: id,
    fullName,
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: [],
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('manifestInterest — integração', () => {
  let authorId = ''; // prestador ativo (phone/emailLogin)
  let inactiveAuthorId = ''; // prestador inativado (MN-05b)

  let serviceId = ''; // serviço ACTIVE do autor (happy/duplicata/consent-ativo)
  let serviceBId = ''; // 2º serviço ACTIVE do autor (AC-033-3)
  let servicePausedId = ''; // serviço PAUSED (MN-05a)
  let serviceInactiveAuthorId = ''; // serviço ACTIVE de autor inativado (MN-05b)
  let serviceRaceId = ''; // serviço dedicado à corrida (MN-03)

  let clientHappyId = ''; // sem papel/consent — happy path + duplicata + AC-033-3
  let clientNoConsentId = ''; // sem consent, sem aceite (MN-02)
  let clientActiveConsentId = ''; // já com CLIENT ACTIVE + consent SERVICE_HIRING
  let clientPausedId = ''; // manifesta em serviço PAUSED (MN-05a)
  let clientInactiveAuthorId = ''; // manifesta em serviço de autor inativado (MN-05b)
  let clientRaceId = ''; // corrida (MN-03)

  async function cleanup() {
    const stalePeople = await prisma.person.findMany({
      where: { fullName: { startsWith: 'Manifest Int' } },
      select: { id: true },
    });
    if (stalePeople.length > 0) {
      const ids = stalePeople.map((p) => p.id);
      await prisma.outbox.deleteMany({});
      await prisma.serviceInterest.deleteMany({
        where: { OR: [{ clientPersonId: { in: ids } }, { service: { authorPersonId: { in: ids } } }] },
      });
      await prisma.service.deleteMany({ where: { authorPersonId: { in: ids } } });
      await prisma.clientProfile.deleteMany({ where: { personId: { in: ids } } });
      await prisma.personRoleGrant.deleteMany({ where: { personId: { in: ids } } });
      await prisma.consent.deleteMany({ where: { personId: { in: ids } } });
      await prisma.person.deleteMany({ where: { id: { in: ids } } });
    }
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: {
        fullName: 'Manifest Int Prestador',
        status: 'ATIVO',
        phone: '11988887777',
        emailLogin: 'manifest-int-prestador@example.com',
      },
      select: { id: true },
    });
    authorId = author.id;

    const inactiveAuthor = await prisma.person.create({
      data: { fullName: 'Manifest Int Prestador Inativo', status: 'ATIVO', inactivatedAt: new Date() },
      select: { id: true },
    });
    inactiveAuthorId = inactiveAuthor.id;

    const [service, serviceB, servicePaused, serviceInactiveAuthor, serviceRace] = await Promise.all([
      prisma.service.create({
        data: { authorPersonId: authorId, title: 'Serviço Manifest Int', status: 'ACTIVE', publishedAt: new Date() },
        select: { id: true },
      }),
      prisma.service.create({
        data: { authorPersonId: authorId, title: 'Serviço Manifest Int B', status: 'ACTIVE', publishedAt: new Date() },
        select: { id: true },
      }),
      prisma.service.create({
        data: { authorPersonId: authorId, title: 'Serviço Manifest Int Pausado', status: 'PAUSED', publishedAt: new Date() },
        select: { id: true },
      }),
      prisma.service.create({
        data: {
          authorPersonId: inactiveAuthorId,
          title: 'Serviço Manifest Int Autor Inativo',
          status: 'ACTIVE',
          publishedAt: new Date(),
        },
        select: { id: true },
      }),
      prisma.service.create({
        data: { authorPersonId: authorId, title: 'Serviço Manifest Int Corrida', status: 'ACTIVE', publishedAt: new Date() },
        select: { id: true },
      }),
    ]);
    serviceId = service.id;
    serviceBId = serviceB.id;
    servicePausedId = servicePaused.id;
    serviceInactiveAuthorId = serviceInactiveAuthor.id;
    serviceRaceId = serviceRace.id;

    async function clientWithPortalAccess(fullName: string) {
      const p = await prisma.person.create({ data: { fullName, status: 'ATIVO' }, select: { id: true } });
      await prisma.consent.create({
        data: { personId: p.id, purpose: 'PORTAL_ACCESS', termVersion: 'v1.0', termContentHash: 'manifest-int-hash' },
      });
      return p.id;
    }

    clientHappyId = await clientWithPortalAccess('Manifest Int Cliente Happy');
    clientNoConsentId = await clientWithPortalAccess('Manifest Int Cliente SemConsent');
    clientPausedId = await clientWithPortalAccess('Manifest Int Cliente Pausado');
    clientInactiveAuthorId = await clientWithPortalAccess('Manifest Int Cliente AutorInativo');
    clientRaceId = await clientWithPortalAccess('Manifest Int Cliente Corrida');

    clientActiveConsentId = await clientWithPortalAccess('Manifest Int Cliente ConsentAtivo');
    await prisma.consent.create({
      data: {
        personId: clientActiveConsentId,
        purpose: 'SERVICE_HIRING',
        termVersion: 'v1.0',
        termContentHash: 'manifest-int-hash',
      },
    });
    const grant = await prisma.personRoleGrant.create({
      data: { personId: clientActiveConsentId, role: 'CLIENT', status: 'ACTIVE' },
      select: { id: true },
    });
    await prisma.clientProfile.create({ data: { personId: clientActiveConsentId } });
    await prisma.auditLog.create({
      data: {
        action: 'CLIENT_ROLE_ACTIVATED',
        actorPersonId: clientActiveConsentId,
        entityType: 'person_role_grant',
        entityId: grant.id,
        after: { role: 'CLIENT', status: 'ACTIVE', via: 'seed' },
      },
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it('@ac-033-e1 Zod: serviceId inválido → VALIDATION, sem tocar o banco', async () => {
    mockPerson = personOf(clientHappyId, 'Manifest Int Cliente Happy');
    const res = await manifestInterest({ serviceId: 'not-a-uuid' });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('@ac-033-e2 unauth: sem sessão → UNAUTHENTICATED', async () => {
    mockPerson = null;
    const res = await manifestInterest({ serviceId });
    expect(res).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
  });

  it('@ac-033-e3 serviço inexistente → NOT_FOUND', async () => {
    mockPerson = personOf(clientHappyId, 'Manifest Int Cliente Happy');
    const res = await manifestInterest({ serviceId: '00000000-0000-0000-0000-0000000000ff' });
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('@svc033-mn-05 serviço PAUSED → PRECONDITION_FAILED, 0 escrita', async () => {
    mockPerson = personOf(clientPausedId, 'Manifest Int Cliente Pausado');
    const res = await manifestInterest({ serviceId: servicePausedId, consentAccepted: true });
    expect(res).toMatchObject({ ok: false, error: { code: 'PRECONDITION_FAILED' } });

    const count = await prisma.serviceInterest.count({
      where: { serviceId: servicePausedId, clientPersonId: clientPausedId },
    });
    expect(count).toBe(0);
  });

  it('@svc033-mn-05 serviço de autor inativado → PRECONDITION_FAILED, 0 escrita', async () => {
    mockPerson = personOf(clientInactiveAuthorId, 'Manifest Int Cliente AutorInativo');
    const res = await manifestInterest({ serviceId: serviceInactiveAuthorId, consentAccepted: true });
    expect(res).toMatchObject({ ok: false, error: { code: 'PRECONDITION_FAILED' } });

    const count = await prisma.serviceInterest.count({
      where: { serviceId: serviceInactiveAuthorId, clientPersonId: clientInactiveAuthorId },
    });
    expect(count).toBe(0);
  });

  it('@svc033-mn-04 autor tenta manifestar no próprio serviço → PRECONDITION_FAILED, 0 escrita', async () => {
    mockPerson = personOf(authorId, 'Manifest Int Prestador');
    const res = await manifestInterest({ serviceId, consentAccepted: true });
    expect(res).toMatchObject({ ok: false, error: { code: 'PRECONDITION_FAILED' } });

    const count = await prisma.serviceInterest.count({ where: { serviceId, clientPersonId: authorId } });
    expect(count).toBe(0);
  });

  it('@svc033-mn-02 consent ausente sem aceite → CONSENT_REQUIRED, 0 escrita, papel não ativado', async () => {
    const outboxBefore = await prisma.outbox.count({});

    mockPerson = personOf(clientNoConsentId, 'Manifest Int Cliente SemConsent');
    const res = await manifestInterest({ serviceId });
    expect(res).toMatchObject({ ok: false, error: { code: 'CONSENT_REQUIRED' } });

    const count = await prisma.serviceInterest.count({ where: { serviceId, clientPersonId: clientNoConsentId } });
    expect(count).toBe(0);
    const grant = await prisma.personRoleGrant.findFirst({
      where: { personId: clientNoConsentId, role: 'CLIENT' },
    });
    expect(grant).toBeNull();
    const outboxAfter = await prisma.outbox.count({});
    expect(outboxAfter).toBe(outboxBefore);
  });

  it('@ac-033-1 @ac-033-2 happy: persiste, ativa papel CLIENT, audita, enfileira e-mail, retorna contato', async () => {
    mockPerson = personOf(clientHappyId, 'Manifest Int Cliente Happy');
    const res = await manifestInterest({ serviceId, consentAccepted: true });
    expect(res).toMatchObject({ ok: true });
    if (!res.ok) return;

    expect(res.data.interestId).toBeTruthy();
    expect(res.data.providerContact).toEqual({
      displayName: 'Manifest Int Prestador',
      phone: '11988887777',
      email: 'manifest-int-prestador@example.com',
    });

    const interest = await prisma.serviceInterest.findUnique({
      where: { id: res.data.interestId },
      select: { serviceId: true, clientPersonId: true, cancelledAt: true },
    });
    expect(interest).toMatchObject({ serviceId, clientPersonId: clientHappyId, cancelledAt: null });

    const grant = await prisma.personRoleGrant.findFirst({
      where: { personId: clientHappyId, role: 'CLIENT', status: 'ACTIVE' },
    });
    expect(grant).not.toBeNull();

    const consent = await prisma.consent.findFirst({
      where: { personId: clientHappyId, purpose: 'SERVICE_HIRING', revokedAt: null },
    });
    expect(consent).not.toBeNull();

    const auditManifested = await prisma.auditLog.findFirst({
      where: { action: 'INTEREST_MANIFESTED', actorPersonId: clientHappyId, entityType: 'SERVICE_INTEREST' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(auditManifested).not.toBeNull();
    expect(auditManifested?.entityId).toBe(res.data.interestId);

    const auditRevealed = await prisma.auditLog.findFirst({
      where: { action: 'PROVIDER_CONTACT_REVEALED', actorPersonId: clientHappyId, entityId: serviceId },
      orderBy: { occurredAt: 'desc' },
    });
    expect(auditRevealed).not.toBeNull();

    const auditRoleActivated = await prisma.auditLog.findFirst({
      where: { action: 'CLIENT_ROLE_ACTIVATED', actorPersonId: clientHappyId },
    });
    expect(auditRoleActivated).not.toBeNull();

    const outboxMsg = await prisma.outbox.findFirst({
      where: { topic: 'email' },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    });
    expect(outboxMsg).not.toBeNull();
    const payload = outboxMsg?.payload as { to: string; template: string; data: Record<string, unknown> };
    expect(payload.template).toBe('service-interest-notification');
    expect(payload.to).toBe('manifest-int-prestador@example.com');
    expect(payload.data).toMatchObject({ servicoTitulo: 'Serviço Manifest Int' });
  });

  it('@ac-033-3 múltiplas manifestações em serviços DIFERENTES coexistem ativas', async () => {
    mockPerson = personOf(clientHappyId, 'Manifest Int Cliente Happy');
    const res = await manifestInterest({ serviceId: serviceBId });
    expect(res).toMatchObject({ ok: true });

    const activeCount = await prisma.serviceInterest.count({
      where: { clientPersonId: clientHappyId, cancelledAt: null },
    });
    expect(activeCount).toBe(2); // serviceId + serviceBId
  });

  it('duplicata sequencial no MESMO serviço → CONFLICT, 1 linha ativa', async () => {
    mockPerson = personOf(clientHappyId, 'Manifest Int Cliente Happy');
    const res = await manifestInterest({ serviceId });
    expect(res).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });

    const activeCount = await prisma.serviceInterest.count({
      where: { serviceId, clientPersonId: clientHappyId, cancelledAt: null },
    });
    expect(activeCount).toBe(1);
  });

  it('consent SERVICE_HIRING já ativo → manifesta sem novo aceite, sem novo CLIENT_ROLE_ACTIVATED', async () => {
    const auditBefore = await prisma.auditLog.count({
      where: { action: 'CLIENT_ROLE_ACTIVATED', actorPersonId: clientActiveConsentId },
    });

    mockPerson = personOf(clientActiveConsentId, 'Manifest Int Cliente ConsentAtivo');
    const res = await manifestInterest({ serviceId });
    expect(res).toMatchObject({ ok: true });

    const auditAfter = await prisma.auditLog.count({
      where: { action: 'CLIENT_ROLE_ACTIVATED', actorPersonId: clientActiveConsentId },
    });
    expect(auditAfter).toBe(auditBefore); // sem novo evento — ensureClientRole foi no-op

    const consentCount = await prisma.consent.count({
      where: { personId: clientActiveConsentId, purpose: 'SERVICE_HIRING', revokedAt: null },
    });
    expect(consentCount).toBe(1); // sem duplicar consent
  });

  it('@svc033-mn-03 corrida: duas manifestações concorrentes do mesmo cliente → 1 ok, 1 CONFLICT (índice único parcial)', async () => {
    mockPerson = personOf(clientRaceId, 'Manifest Int Cliente Corrida');
    const results = await Promise.all([
      manifestInterest({ serviceId: serviceRaceId, consentAccepted: true }),
      manifestInterest({ serviceId: serviceRaceId, consentAccepted: true }),
    ]);

    expect(results.filter((r) => r.ok).length).toBe(1);
    expect(results.filter((r) => !r.ok && r.error.code === 'CONFLICT').length).toBe(1);

    const activeCount = await prisma.serviceInterest.count({
      where: { serviceId: serviceRaceId, clientPersonId: clientRaceId, cancelledAt: null },
    });
    expect(activeCount).toBe(1);
  });
});
