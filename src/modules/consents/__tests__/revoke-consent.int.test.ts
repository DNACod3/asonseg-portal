import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Teste de integração fim-a-fim de `revokeConsent` para `JOB_APPLICATION`
 * (USP-053 / CAND-7). Requer Postgres local (`supabase start`) e
 * `DATABASE_URL` no env. Container real (adapter de produção registrado em
 * `shared/container.ts`) — só a atomicidade (MN-04) sobrescreve o binding
 * temporariamente com um applier que lança, restaurado no `afterEach`.
 *
 * Mocks: `next/headers` (IP/UA) e `@/modules/identity` (titular autenticado)
 * — mesmo padrão de `inactivate-person.int.test.ts`. Real: Prisma/Postgres +
 * container (cascata de artefatos) — valida ENCERRAR+MARCAR (USP053-01),
 * OCULTAR (USP053-02), o resumo agregado (USP053-03), a atomicidade
 * (USP053-04/MN-04), a ausência de cascata sem candidaturas ativas
 * (USP053-E1) e o isolamento por titular (MN-01/MN-02/MN-05).
 */

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;

vi.mock('@/modules/identity', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { container } = await import('@/shared/container');
const { revokeConsent } = await import('../actions/revoke-consent');
const { REVOCATION_EFFECTS_TOKEN } = await import('../ports/revocation-effects');
const { searchCandidates } = await import('@/modules/persons');

// Captura o adapter de PRODUÇÃO (composto por endJobApplicationsForRevocation +
// hideCandidateProfileForRevocation, registrado em `shared/container.ts` na
// importação acima) — `resolve` é memoizado (singleton), então esta é a
// mesma instância real que `revokeConsent` usaria fora do teste de
// atomicidade. Restaurada no `afterEach` sem duplicar a composição do adapter
// (evita deep-import de `jobs`/`persons` só para reconstituí-la aqui).
const productionApplier = container.resolve(REVOCATION_EFFECTS_TOKEN);

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '05777888000155';
const SETOR = 'Revoke Consent Cascade Int';
const TERM = { version: 'job-application@v1.0', hash: 'revoke-consent-int-hash' };

const responsible: CurrentPerson = {
  id: 'viewer-revoke-cascade',
  supabaseUserId: '00000000-0000-0000-0000-0000000000ee',
  fullName: 'Responsável Revoke Cascade Int',
  status: 'ATIVO',
  primeiroAcesso: false,
  roles: ['COMPANY_RESPONSIBLE'],
  phone: null,
  fullAddress: null,
};

function personOf(id: string, fullName: string): CurrentPerson {
  return {
    id,
    supabaseUserId: id,
    fullName,
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['CANDIDATE'],
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('revokeConsent — cascata JOB_APPLICATION (integração, USP-053/CAND-7)', () => {
  let authorId = '';
  let companyId = '';
  let jobAId = '';
  let jobBId = '';

  async function seedTitular(opts: {
    fullName: string;
    withActiveApplications: boolean;
  }): Promise<{ personId: string; appAId?: string; appBId?: string }> {
    const person = await prisma.person.create({
      data: { fullName: opts.fullName, status: 'ATIVO' },
      select: { id: true },
    });
    await prisma.consent.create({
      data: { personId: person.id, purpose: 'JOB_APPLICATION', termVersion: TERM.version, termContentHash: TERM.hash },
    });
    await prisma.personRoleGrant.create({ data: { personId: person.id, role: 'CANDIDATE', status: 'ACTIVE' } });
    await prisma.candidateProfile.create({ data: { personId: person.id, publicationStatus: 'ACTIVE' } });

    if (!opts.withActiveApplications) return { personId: person.id };

    const appA = await prisma.application.create({
      data: { jobId: jobAId, candidatePersonId: person.id, viaEncaminhamento: false },
      select: { id: true },
    });
    const appB = await prisma.application.create({
      data: { jobId: jobBId, candidatePersonId: person.id, viaEncaminhamento: false },
      select: { id: true },
    });
    return { personId: person.id, appAId: appA.id, appBId: appB.id };
  }

  async function cleanup() {
    const company = await prisma.company.findUnique({ where: { cnpj: CNPJ }, select: { id: true } });
    if (company) {
      await prisma.application.deleteMany({ where: { job: { companyId: company.id } } });
      await prisma.job.deleteMany({ where: { companyId: company.id } });
      await prisma.company.delete({ where: { id: company.id } });
    }
    const stalePeople = await prisma.person.findMany({
      where: { fullName: { startsWith: 'Revoke Cascade Int' } },
      select: { id: true },
    });
    if (stalePeople.length > 0) {
      const ids = stalePeople.map((p) => p.id);
      await prisma.consent.deleteMany({ where: { personId: { in: ids } } });
      await prisma.candidateProfile.deleteMany({ where: { personId: { in: ids } } });
      await prisma.personRoleGrant.deleteMany({ where: { personId: { in: ids } } });
      await prisma.person.deleteMany({ where: { id: { in: ids } } });
    }
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: 'Revoke Cascade Int Autor', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        razaoSocial: 'Revoke Consent Cascade Int Ltda',
        nomeFantasia: 'Revoke Consent Cascade Int',
        setor: SETOR,
        isVerified: true,
        createdBy: authorId,
      },
      select: { id: true },
    });
    companyId = company.id;

    const future = new Date();
    future.setDate(future.getDate() + 30);

    const jobA = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga A Revoke Cascade Int', status: 'ACTIVE', validUntil: future },
      select: { id: true },
    });
    jobAId = jobA.id;
    const jobB = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga B Revoke Cascade Int', status: 'ACTIVE', validUntil: future },
      select: { id: true },
    });
    jobBId = jobB.id;
  });

  afterAll(async () => {
    await cleanup();
    if (authorId) await prisma.person.deleteMany({ where: { id: authorId } });
  });

  afterEach(() => {
    // Restaura a instância de produção após o teste de atomicidade (que a sobrescreve).
    container.register(REVOCATION_EFFECTS_TOKEN, () => productionApplier);
  });

  it('USP053-01/02/03: revoga JOB_APPLICATION com candidaturas ativas — encerra, oculta e resume no after', async () => {
    const { personId, appAId, appBId } = await seedTitular({
      fullName: 'Revoke Cascade Int Titular Happy',
      withActiveApplications: true,
    });
    mockPerson = personOf(personId, 'Revoke Cascade Int Titular Happy');

    const before = await searchCandidates({}, responsible);
    expect(before.ok).toBe(true);
    if (before.ok) expect(before.data.items.map((i) => i.candidatePersonId)).toContain(personId);

    const result = await revokeConsent({ purpose: 'JOB_APPLICATION', reason: 'Não quero mais participar' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      consentsRevoked: 1,
      roleRevoked: true,
      alreadyRevoked: false,
      applicationsEnded: 2,
      profileHidden: true,
    });

    // USP053-01/MN-01: candidaturas ativas encerradas, fora da contagem ativa, linhas preservadas.
    const activeCount = await prisma.application.count({ where: { candidatePersonId: personId, cancelledAt: null } });
    expect(activeCount).toBe(0);
    const rows = await prisma.application.findMany({
      where: { id: { in: [appAId!, appBId!] } },
      select: { id: true, cancelledAt: true },
    });
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.cancelledAt).not.toBeNull();

    for (const id of [appAId!, appBId!]) {
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'APPLICATION_CANCELLED', entityId: id },
        select: { after: true },
      });
      expect(audit?.after).toMatchObject({ via: 'consent_revoke' });
    }

    // USP053-02/MN-02: perfil oculto, ausente da busca ativa.
    const profile = await prisma.candidateProfile.findUnique({
      where: { personId },
      select: { publicationStatus: true },
    });
    expect(profile?.publicationStatus).toBe('PAUSED');
    const after = await searchCandidates({}, responsible);
    expect(after.ok).toBe(true);
    if (after.ok) expect(after.data.items.map((i) => i.candidatePersonId)).not.toContain(personId);

    // Papel cascateado + resumo agregado no after do evento primário (USP053-03/A-7).
    const grant = await prisma.personRoleGrant.findFirst({ where: { personId, role: 'CANDIDATE' } });
    expect(grant?.status).toBe('REVOKED');
    const consentAudit = await prisma.auditLog.findFirst({
      where: { action: 'CONSENT_REVOKED', actorPersonId: personId },
      orderBy: { occurredAt: 'desc' },
    });
    expect(consentAudit?.after).toMatchObject({ applicationsEnded: 2, profileHidden: true });
  });

  it('USP053-E1: sem candidaturas ativas — applicationsEnded=0, sem APPLICATION_CANCELLED, perfil ainda oculto', async () => {
    const { personId } = await seedTitular({
      fullName: 'Revoke Cascade Int Titular Sem Candidaturas',
      withActiveApplications: false,
    });
    mockPerson = personOf(personId, 'Revoke Cascade Int Titular Sem Candidaturas');

    const result = await revokeConsent({ purpose: 'JOB_APPLICATION' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ applicationsEnded: 0, profileHidden: true });

    const auditCount = await prisma.auditLog.count({
      where: { action: 'APPLICATION_CANCELLED', actorPersonId: personId },
    });
    expect(auditCount).toBe(0);

    const profile = await prisma.candidateProfile.findUnique({
      where: { personId },
      select: { publicationStatus: true },
    });
    expect(profile?.publicationStatus).toBe('PAUSED');
  });

  it('USP053-MN-05: cascata de um titular não toca candidatura/perfil de outra Pessoa', async () => {
    const alvo = await seedTitular({ fullName: 'Revoke Cascade Int Titular Alvo', withActiveApplications: true });
    const outro = await seedTitular({ fullName: 'Revoke Cascade Int Outro Titular', withActiveApplications: true });
    mockPerson = personOf(alvo.personId, 'Revoke Cascade Int Titular Alvo');

    const result = await revokeConsent({ purpose: 'JOB_APPLICATION' });
    expect(result.ok).toBe(true);

    const outroActiveCount = await prisma.application.count({
      where: { candidatePersonId: outro.personId, cancelledAt: null },
    });
    expect(outroActiveCount).toBe(2);
    const outroProfile = await prisma.candidateProfile.findUnique({
      where: { personId: outro.personId },
      select: { publicationStatus: true },
    });
    expect(outroProfile?.publicationStatus).toBe('ACTIVE');
  });

  it('USP053-04/MN-04: falha injetada no applier faz rollback total — consentimento, papel, candidaturas e perfil intocados', async () => {
    const { personId, appAId, appBId } = await seedTitular({
      fullName: 'Revoke Cascade Int Titular Rollback',
      withActiveApplications: true,
    });
    mockPerson = personOf(personId, 'Revoke Cascade Int Titular Rollback');

    container.register(REVOCATION_EFFECTS_TOKEN, () => ({
      async applyJobApplicationCascade(): Promise<never> {
        throw new Error('falha simulada no applier (USP053-MN-04)');
      },
    }));

    const result = await revokeConsent({ purpose: 'JOB_APPLICATION' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INTERNAL');

    const consent = await prisma.consent.findFirst({ where: { personId, purpose: 'JOB_APPLICATION' } });
    expect(consent?.revokedAt).toBeNull();

    const grant = await prisma.personRoleGrant.findFirst({ where: { personId, role: 'CANDIDATE' } });
    expect(grant?.status).toBe('ACTIVE');

    const rows = await prisma.application.findMany({
      where: { id: { in: [appAId!, appBId!] } },
      select: { cancelledAt: true },
    });
    for (const row of rows) expect(row.cancelledAt).toBeNull();

    const profile = await prisma.candidateProfile.findUnique({
      where: { personId },
      select: { publicationStatus: true },
    });
    expect(profile?.publicationStatus).toBe('ACTIVE');
  });
});
