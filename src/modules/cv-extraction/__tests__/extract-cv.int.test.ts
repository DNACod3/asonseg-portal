import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';
import type { CVExtractor, CvExtractionResult } from '../ports/cv-extractor.port';

/**
 * Testes de integração de `extractCvFromUpload` (USP-040 / CVE-02, T13).
 * Requer Postgres local (`supabase start`, Storage incluso).
 *
 * Real: Prisma/Postgres + Supabase Storage (download de verdade de um CV
 * previamente armazenado) + `audit_log`. Mock: `next/headers`,
 * `getCurrentPerson`, e o extractor — via `container.register(CV_EXTRACTOR_TOKEN,
 * ...)` com um fake espião (`vi.fn`), controlável por teste.
 *
 * Cobre: happy path (REQUESTED+COMPLETED com metadados, sem persistir —
 * CVE-MN-01); revogação de consentimento entre upload e extração (CVE-MN-03 —
 * extractor NÃO chamado); falha/vazio do extractor → fallback gracioso sem
 * throw (CVE-05 / CVE-MN-06); precondição sem `cvStoragePath`.
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.10', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;
vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { container } = await import('@/shared/container');
const { createSupabaseStorageClient, STORAGE_BUCKETS } = await import(
  '@/shared/lib/supabase/supabase-storage'
);
const { CV_EXTRACTOR_TOKEN } = await import('../ports/cv-extractor.port');
const { extractCvFromUpload } = await import('../actions/extract-cv');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const extractSpy = vi.fn<CVExtractor['extract']>();
const fakeExtractor: CVExtractor = { extract: extractSpy };

function baseMockPerson(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: '00000000-0000-0000-0000-0000000000dd',
    fullName: 'Candidato Extração Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['CANDIDATE'],
    phone: null,
    fullAddress: null,
  };
}

const OK_RESULT: CvExtractionResult = {
  ok: true,
  fields: {
    educationLevel: 'ENSINO_SUPERIOR',
    educationArea: 'Administração',
    experienceText: '5 anos como auxiliar administrativo',
    skillsText: null,
    coursesText: null,
  },
  usage: {
    inputTokens: 1500,
    outputTokens: 200,
    durationMs: 900,
    estimatedCostUsd: 0.0075,
    model: 'claude-sonnet-4-6',
  },
};

skipIfNoDb('USP-040 / CVE-02 — extractCvFromUpload (integração)', () => {
  let personHappyId = '';
  let personRevokedId = '';
  let personFallbackId = '';
  let personNoUploadId = '';
  const uploadedPaths: string[] = [];

  beforeAll(async () => {
    container.register(CV_EXTRACTOR_TOKEN, () => fakeExtractor);
    const storage = createSupabaseStorageClient().from(STORAGE_BUCKETS.CVS);

    async function seedCandidateWithCv(
      label: string,
      consentActive: boolean,
    ): Promise<string> {
      const person = await prisma.person.create({
        data: { fullName: `Candidato ${label} Int`, status: 'ATIVO' },
        select: { id: true },
      });
      const path = `${person.id}/cv.pdf`;
      await storage.upload(path, Buffer.from('%PDF-1.4 fake cv int'), {
        contentType: 'application/pdf',
        upsert: true,
      });
      uploadedPaths.push(`${person.id}/cv.pdf`);
      await prisma.candidateProfile.create({
        data: { personId: person.id, cvStoragePath: path, cvUploadedAt: new Date() },
      });
      const consent = await prisma.consent.create({
        data: {
          personId: person.id,
          purpose: 'CV_AI_EXTRACTION',
          termVersion: 'v1.0',
          termContentHash: 'x',
        },
      });
      if (!consentActive) {
        await prisma.consent.update({
          where: { id: consent.id },
          data: { revokedAt: new Date(), revokedReason: 'teste de integração' },
        });
      }
      return person.id;
    }

    personHappyId = await seedCandidateWithCv('Happy', true);
    personRevokedId = await seedCandidateWithCv('Revogado', false);
    personFallbackId = await seedCandidateWithCv('Fallback', true);

    const noUpload = await prisma.person.create({
      data: { fullName: 'Candidato Sem Upload Int', status: 'ATIVO' },
      select: { id: true },
    });
    personNoUploadId = noUpload.id;
    await prisma.candidateProfile.create({ data: { personId: personNoUploadId } });
  });

  afterAll(async () => {
    const allPersonIds = [personHappyId, personRevokedId, personFallbackId, personNoUploadId];
    const storage = createSupabaseStorageClient().from(STORAGE_BUCKETS.CVS);
    if (uploadedPaths.length > 0) {
      await storage.remove(uploadedPaths);
    }
    await prisma.candidateProfile.deleteMany({ where: { personId: { in: allPersonIds } } });
    await prisma.consent.deleteMany({
      where: { personId: { in: [personHappyId, personRevokedId, personFallbackId] } },
    });
    await prisma.person.deleteMany({ where: { id: { in: allPersonIds } } });
  });

  beforeEach(() => {
    extractSpy.mockReset();
  });

  it('CVE-02 happy path: audita REQUESTED+COMPLETED com metadados e retorna o draft sem persistir', async () => {
    mockPerson = baseMockPerson(personHappyId);
    extractSpy.mockResolvedValue(OK_RESULT);

    const res = await extractCvFromUpload();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({ extracted: OK_RESULT.fields, fromAi: true, fallback: false });

    expect(extractSpy).toHaveBeenCalledOnce();

    const requested = await prisma.auditLog.findFirst({
      where: { action: 'CV_EXTRACTION_REQUESTED', actorPersonId: personHappyId },
    });
    expect(requested).not.toBeNull();

    const completed = await prisma.auditLog.findFirst({
      where: { action: 'CV_EXTRACTION_COMPLETED', actorPersonId: personHappyId },
      orderBy: { id: 'desc' },
    });
    expect(completed).not.toBeNull();
    const after = completed?.after as Record<string, unknown> | null;
    expect(after).toMatchObject({
      inputTokens: 1500,
      outputTokens: 200,
      durationMs: 900,
      estimatedCostUsd: 0.0075,
      model: 'claude-sonnet-4-6',
    });
    // Auditoria guarda metadados — NUNCA os valores extraídos (PII).
    expect(after).not.toHaveProperty('educationLevel');
    expect(after).not.toHaveProperty('experienceText');
    expect(JSON.stringify(after)).not.toContain('Administração');
  });

  it('CVE-MN-01: após a extração, os campos estruturados de candidate_profiles continuam inalterados', async () => {
    mockPerson = baseMockPerson(personHappyId);
    extractSpy.mockResolvedValue(OK_RESULT);

    await extractCvFromUpload();

    const profile = await prisma.candidateProfile.findUnique({
      where: { personId: personHappyId },
      select: {
        educationLevel: true,
        educationArea: true,
        experienceText: true,
        skillsText: true,
        coursesText: true,
        cvLastConfirmedAt: true,
      },
    });
    expect(profile).toEqual({
      educationLevel: null,
      educationArea: null,
      experienceText: null,
      skillsText: null,
      coursesText: null,
      cvLastConfirmedAt: null,
    });
  });

  it('CVE-MN-03: consentimento revogado entre upload e extração bloqueia e NÃO chama o extractor', async () => {
    mockPerson = baseMockPerson(personRevokedId);

    const res = await extractCvFromUpload();
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('CONSENT_REQUIRED');
    expect(extractSpy).not.toHaveBeenCalled();

    const completed = await prisma.auditLog.findFirst({
      where: { action: 'CV_EXTRACTION_COMPLETED', actorPersonId: personRevokedId },
    });
    expect(completed).toBeNull();
  });

  it('CVE-05/CVE-MN-06: falha do extractor (ok:false) vira fallback gracioso, sem throw', async () => {
    mockPerson = baseMockPerson(personFallbackId);
    extractSpy.mockResolvedValue({ ok: false, reason: 'EMPTY' });

    const res = await extractCvFromUpload();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({ extracted: null, fromAi: false, fallback: true });

    const failed = await prisma.auditLog.findFirst({
      where: { action: 'CV_EXTRACTION_FAILED', actorPersonId: personFallbackId },
    });
    expect(failed).not.toBeNull();
    expect((failed?.after as Record<string, unknown> | null)?.reason).toBe('EMPTY');
  });

  it('precondição: sem cvStoragePath bloqueia com PRECONDITION_FAILED', async () => {
    mockPerson = baseMockPerson(personNoUploadId);

    const res = await extractCvFromUpload();
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('PRECONDITION_FAILED');
    expect(extractSpy).not.toHaveBeenCalled();
  });

  it('não autenticado: bloqueia com UNAUTHENTICATED', async () => {
    mockPerson = null;

    const res = await extractCvFromUpload();
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('UNAUTHENTICATED');
  });
});
