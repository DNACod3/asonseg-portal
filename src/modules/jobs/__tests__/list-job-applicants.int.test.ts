import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `listJobApplicants` (USP-027 / CAN-03). Requer Postgres
 * local (`supabase start`, Storage incluso — bucket `cvs` declarado em
 * `supabase/config.toml`).
 *
 * Real: Prisma/Postgres + Supabase Storage (signed URL de verdade contra o bucket
 * local `cvs`) + `audit_log`. Mock: `next/headers` (IP/UA da request, mesmo padrão
 * de `inactivate-person.int.test.ts`). Cobre ownership (USP027-MN-02), exclusão de
 * canceladas (USP027-MN-03), auditoria (USP027-MN-04), sensor de discriminação de
 * PII (USP027-MN-01/MN-05), NOT_FOUND, estado vazio e o badge de encaminhamento.
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.5', 'user-agent': 'vitest/int' })),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { createSupabaseStorageClient } = await import('@/shared/lib/supabase/supabase-storage');
const { listJobApplicants } = await import('../queries/list-job-applicants');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ_A = '11444777000230';
const CNPJ_B = '11444777000231';
const SETOR = 'Candidatos Int';

const CPF_SENSOR = '52998224725'; // CPF válido (algoritmo) usado só como sensor de vazamento
const ENDERECO_SENSOR = 'Rua Sensível Candidatos Int, 999';
// Diferente da USP-028 (só primeiro nome), a USP-027 legitimamente expõe o nome
// COMPLETO ao empregador (a candidatura é o consentimento do contato) — o sensor
// aqui cobre só os campos que o Must-Not proíbe (cpf/birthDate/fullAddress), não o nome.

function viewerFor(personId: string): CurrentPerson {
  return {
    id: personId,
    supabaseUserId: '00000000-0000-0000-0000-0000000000bb',
    fullName: 'Responsável Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['COMPANY_RESPONSIBLE'],
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('listJobApplicants — integração', () => {
  let responsibleAId = '';
  let responsibleBId = '';
  let companyAId = '';
  let companyBId = '';
  let jobId = '';
  let jobEmptyId = '';
  let candidateWithCvId = '';
  let candidateNoCvId = '';
  let candidateReferralId = '';
  let candidateCancelledId = '';
  const CV_PATH = 'candidatos-int/cv-sensor.pdf';

  async function cleanup() {
    await prisma.application.deleteMany({ where: { job: { company: { cnpj: { in: [CNPJ_A, CNPJ_B] } } } } });
    await prisma.candidateProfile.deleteMany({ where: { person: { fullName: { startsWith: 'Candidatos Int' } } } });
    await prisma.job.deleteMany({ where: { company: { cnpj: { in: [CNPJ_A, CNPJ_B] } } } });
    await prisma.personCompanyGrant.deleteMany({ where: { company: { cnpj: { in: [CNPJ_A, CNPJ_B] } } } });
    await prisma.company.deleteMany({ where: { cnpj: { in: [CNPJ_A, CNPJ_B] } } });
    await prisma.person.deleteMany({ where: { fullName: { startsWith: 'Candidatos Int' } } });
    // `audit_log` é append-only (REVOKE DELETE no banco, ADR-0023) — não é limpo.
  }

  beforeAll(async () => {
    await cleanup();

    const [respA, respB] = await Promise.all([
      prisma.person.create({ data: { fullName: 'Candidatos Int Responsável A', status: 'ATIVO' }, select: { id: true } }),
      prisma.person.create({ data: { fullName: 'Candidatos Int Responsável B', status: 'ATIVO' }, select: { id: true } }),
    ]);
    responsibleAId = respA.id;
    responsibleBId = respB.id;

    const [companyA, companyB] = await Promise.all([
      prisma.company.create({
        data: {
          cnpj: CNPJ_A,
          razaoSocial: 'Candidatos Int Ltda A',
          nomeFantasia: 'Candidatos Int A',
          setor: SETOR,
          isVerified: true,
          createdBy: responsibleAId,
        },
        select: { id: true },
      }),
      prisma.company.create({
        data: {
          cnpj: CNPJ_B,
          razaoSocial: 'Candidatos Int Ltda B',
          nomeFantasia: 'Candidatos Int B',
          setor: SETOR,
          isVerified: true,
          createdBy: responsibleBId,
        },
        select: { id: true },
      }),
    ]);
    companyAId = companyA.id;
    companyBId = companyB.id;

    await prisma.personCompanyGrant.createMany({
      data: [
        {
          personId: responsibleAId,
          companyId: companyAId,
          grantType: 'RESPONSIBLE',
          status: 'ACTIVE',
          grantedBy: responsibleAId,
        },
        {
          personId: responsibleBId,
          companyId: companyBId,
          grantType: 'RESPONSIBLE',
          status: 'ACTIVE',
          grantedBy: responsibleBId,
        },
      ],
    });

    const [job, jobEmpty] = await Promise.all([
      prisma.job.create({
        data: { companyId: companyAId, authorPersonId: responsibleAId, title: 'Vaga Candidatos Int', status: 'ACTIVE' },
        select: { id: true },
      }),
      prisma.job.create({
        data: { companyId: companyAId, authorPersonId: responsibleAId, title: 'Vaga Candidatos Int Vazia', status: 'ACTIVE' },
        select: { id: true },
      }),
    ]);
    jobId = job.id;
    jobEmptyId = jobEmpty.id;

    const [withCv, noCv, referral, cancelled] = await Promise.all([
      prisma.person.create({
        data: {
          fullName: 'Candidatos Int Ana',
          status: 'ATIVO',
          emailLogin: `ana.candidatos.int.${Date.now()}@example.com`,
          phone: '11988880001',
          cpf: CPF_SENSOR,
          fullAddress: ENDERECO_SENSOR,
          birthDate: new Date('1990-01-01'),
        },
        select: { id: true },
      }),
      prisma.person.create({
        data: { fullName: 'Candidatos Int Bruno', status: 'ATIVO', emailLogin: `bruno.candidatos.int.${Date.now()}@example.com` },
        select: { id: true },
      }),
      prisma.person.create({
        data: { fullName: 'Candidatos Int Encaminhado', status: 'ATIVO' },
        select: { id: true },
      }),
      prisma.person.create({
        data: { fullName: 'Candidatos Int Cancelado', status: 'ATIVO' },
        select: { id: true },
      }),
    ]);
    candidateWithCvId = withCv.id;
    candidateNoCvId = noCv.id;
    candidateReferralId = referral.id;
    candidateCancelledId = cancelled.id;

    await prisma.candidateProfile.create({
      data: {
        personId: candidateWithCvId,
        cvStoragePath: CV_PATH,
        cvUploadedAt: new Date(),
      },
    });

    // Upload real de um CV-dummy no bucket local `cvs` (Storage do Supabase CLI) —
    // exercita o `createSignedUrl` de verdade, sem mockar o client de Storage.
    const storage = createSupabaseStorageClient();
    await storage.from('cvs').upload(CV_PATH, Buffer.from('%PDF-1.4 fake cv int'), {
      contentType: 'application/pdf',
      upsert: true,
    });

    await prisma.application.createMany({
      data: [
        { candidatePersonId: candidateWithCvId, jobId, appliedAt: new Date('2026-07-01T10:00:00Z') },
        { candidatePersonId: candidateNoCvId, jobId, appliedAt: new Date('2026-07-01T11:00:00Z') },
        { candidatePersonId: candidateReferralId, jobId, appliedAt: new Date('2026-07-01T12:00:00Z') },
        {
          candidatePersonId: candidateCancelledId,
          jobId,
          appliedAt: new Date('2026-07-01T09:00:00Z'),
          cancelledAt: new Date('2026-07-01T13:00:00Z'),
        },
      ],
    });
    // Materializa o badge de encaminhamento (sempre false na criação — Fase 3 não
    // tem Referral ainda; forçamos via update para exercitar a projeção do VM/query).
    await prisma.application.updateMany({
      where: { candidatePersonId: candidateReferralId, jobId },
      data: { viaEncaminhamento: true },
    });
  });

  afterAll(async () => {
    const storage = createSupabaseStorageClient();
    await storage.from('cvs').remove([CV_PATH]);
    await cleanup();
    await prisma.person.deleteMany({ where: { id: { in: [responsibleAId, responsibleBId] } } });
  });

  it('USP027-01/02/03 happy path: só ativas, ordenadas por appliedAt, badge de encaminhamento', async () => {
    const res = await listJobApplicants({ jobId }, viewerFor(responsibleAId));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data.total).toBe(3); // 3 ativas (a cancelada não conta)
    expect(res.data.applicants).toHaveLength(3);
    expect(res.data.applicants.map((a) => a.candidatePersonId)).toEqual([
      candidateWithCvId,
      candidateNoCvId,
      candidateReferralId,
    ]); // ordem por appliedAt ASC

    const referralItem = res.data.applicants.find((a) => a.candidatePersonId === candidateReferralId);
    expect(referralItem?.viaEncaminhamento).toBe(true);
    const withCvItem = res.data.applicants.find((a) => a.candidatePersonId === candidateWithCvId);
    expect(withCvItem?.viaEncaminhamento).toBe(false);
  });

  it('USP027-01: CV presente resolve URL assinada; ausente vira cv.available=false', async () => {
    const res = await listJobApplicants({ jobId }, viewerFor(responsibleAId));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const withCv = res.data.applicants.find((a) => a.candidatePersonId === candidateWithCvId);
    expect(withCv?.cv.available).toBe(true);
    expect(withCv?.cv.url).toMatch(/^https?:\/\//);

    const noCv = res.data.applicants.find((a) => a.candidatePersonId === candidateNoCvId);
    expect(noCv?.cv).toEqual({ available: false, url: null, uploadedAt: null });
    expect(noCv?.contact.phone).toBeNull(); // telefone não informado — "não informado" na UI
  });

  it('USP027-MN-03: candidatura cancelada é excluída da lista', async () => {
    const res = await listJobApplicants({ jobId }, viewerFor(responsibleAId));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.applicants.some((a) => a.candidatePersonId === candidateCancelledId)).toBe(false);
  });

  it('USP027-06/MN-02: responsável de outra Empresa recebe FORBIDDEN, sem carregar candidato', async () => {
    const before = await prisma.auditLog.count({ where: { entityType: 'job', entityId: jobId } });

    const res = await listJobApplicants({ jobId }, viewerFor(responsibleBId));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('FORBIDDEN');

    // MN-04 (via MN-02): consulta negada não grava evento algum sobre a vaga.
    const after = await prisma.auditLog.count({ where: { entityType: 'job', entityId: jobId } });
    expect(after).toBe(before);
  });

  it('USP027-07: vaga inexistente retorna NOT_FOUND', async () => {
    const res = await listJobApplicants(
      { jobId: '00000000-0000-0000-0000-000000000000' },
      viewerFor(responsibleAId),
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('NOT_FOUND');
  });

  it('USP027-08: vaga sem candidaturas ativas retorna lista vazia (sem erro)', async () => {
    const res = await listJobApplicants({ jobId: jobEmptyId }, viewerFor(responsibleAId));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.applicants).toEqual([]);
    expect(res.data.total).toBe(0);
  });

  it('USP027-MN-04: registra APPLICATION_VIEWED_BY_EMPLOYER + SENSITIVE_FIELD_VIEWED por candidato', async () => {
    const res = await listJobApplicants({ jobId }, viewerFor(responsibleAId));
    expect(res.ok).toBe(true);

    const primary = await prisma.auditLog.findFirst({
      where: { action: 'APPLICATION_VIEWED_BY_EMPLOYER', entityId: jobId },
      orderBy: { occurredAt: 'desc' },
    });
    expect(primary).not.toBeNull();
    expect(primary?.actorPersonId).toBe(responsibleAId);

    for (const candidateId of [candidateWithCvId, candidateNoCvId, candidateReferralId]) {
      const secondary = await prisma.auditLog.findFirst({
        where: { action: 'SENSITIVE_FIELD_VIEWED', entityType: 'person', entityId: candidateId },
        orderBy: { occurredAt: 'desc' },
      });
      expect(secondary).not.toBeNull();
    }
  });

  it('USP027-MN-01/MN-05 sensor: CPF e endereço do candidato NÃO aparecem no payload serializado', async () => {
    const res = await listJobApplicants({ jobId }, viewerFor(responsibleAId));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const serialized = JSON.stringify(res.data);
    expect(serialized).not.toContain(CPF_SENSOR);
    expect(serialized).not.toContain(ENDERECO_SENSOR);
  });
});
