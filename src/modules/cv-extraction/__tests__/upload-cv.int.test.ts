import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `uploadCv` (USP-040 / CVE-01, T12). Requer Postgres
 * local (`supabase start`, Storage incluso — bucket `cvs` declarado em
 * `supabase/config.toml`).
 *
 * Real: Prisma/Postgres + Supabase Storage local (upload de verdade no bucket
 * `cvs` no caminho feliz) + `audit_log`. Mocks: `next/headers` (IP/UA),
 * `getCurrentPerson` (sessão), e — só para o teste de falha de Storage — um
 * override controlável de `createSupabaseStorageClient` (partial mock via
 * `importOriginal`, os demais testes usam o Storage real).
 *
 * Cobre: happy path (arquivo armazenado + CV_UPLOADED + CvUploadAttempt +
 * colunas cv* gravadas); MIME inválido (CVE-MN-02 — sem storage); tamanho
 * >5MB; consentimento ausente (CVE-MN-03 — sem storage); 4º upload do dia
 * (CVE-MN-04 — sem storage); falha de Storage (sem CV_UPLOADED); precondição
 * sem `candidate_profiles`.
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;
vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const storageOverride: { fn: (() => unknown) | null } = { fn: null };
vi.mock('@/shared/lib/supabase/supabase-storage', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/shared/lib/supabase/supabase-storage')>();
  return {
    ...actual,
    createSupabaseStorageClient: (...args: unknown[]) =>
      storageOverride.fn
        ? storageOverride.fn()
        : (actual.createSupabaseStorageClient as (...a: unknown[]) => unknown)(...args),
  };
});

const { prisma } = await import('@/shared/lib/prisma');
const { createSupabaseStorageClient, STORAGE_BUCKETS } = await import(
  '@/shared/lib/supabase/supabase-storage'
);
const { uploadCv } = await import('../actions/upload-cv');
const { MAX_CV_BYTES } = await import('../domain/mime');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

function pdfBytes(size = 1024): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
  return bytes;
}

function pdfFile(size = 1024, name = 'cv.pdf'): File {
  return new File([pdfBytes(size) as unknown as BlobPart], name, { type: 'application/pdf' });
}

function baseMockPerson(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: '00000000-0000-0000-0000-0000000000cc',
    fullName: 'Candidato CV Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['CANDIDATE'],
    phone: null,
    fullAddress: null,
  };
}

async function listStorageFiles(personId: string) {
  const storage = createSupabaseStorageClient().from(STORAGE_BUCKETS.CVS);
  const { data } = await storage.list(personId);
  return data ?? [];
}

skipIfNoDb('USP-040 / CVE-01 — uploadCv (integração)', () => {
  let personWithConsentId = '';
  let personValidationId = '';
  let personNoConsentId = '';
  let personNoProfileId = '';
  let personRateLimitId = '';

  beforeAll(async () => {
    const withConsent = await prisma.person.create({
      data: { fullName: 'Candidato Com Consentimento Int', status: 'ATIVO' },
      select: { id: true },
    });
    personWithConsentId = withConsent.id;
    await prisma.candidateProfile.create({ data: { personId: personWithConsentId } });
    await prisma.consent.create({
      data: {
        personId: personWithConsentId,
        purpose: 'CV_AI_EXTRACTION',
        termVersion: 'v1.0',
        termContentHash: 'x',
      },
    });

    // Pessoa dedicada aos testes de MIME/tamanho: precisa de consentimento
    // ativo para alcançar o gate de validação (que vem DEPOIS do consentimento
    // na sequência da action) sem interferir na contagem de rate limit de
    // `personWithConsentId` (usada no caminho feliz).
    const validation = await prisma.person.create({
      data: { fullName: 'Candidato Validação Int', status: 'ATIVO' },
      select: { id: true },
    });
    personValidationId = validation.id;
    await prisma.candidateProfile.create({ data: { personId: personValidationId } });
    await prisma.consent.create({
      data: {
        personId: personValidationId,
        purpose: 'CV_AI_EXTRACTION',
        termVersion: 'v1.0',
        termContentHash: 'x',
      },
    });

    const noConsent = await prisma.person.create({
      data: { fullName: 'Candidato Sem Consentimento Int', status: 'ATIVO' },
      select: { id: true },
    });
    personNoConsentId = noConsent.id;
    await prisma.candidateProfile.create({ data: { personId: personNoConsentId } });

    const noProfile = await prisma.person.create({
      data: { fullName: 'Candidato Sem Perfil Int', status: 'ATIVO' },
      select: { id: true },
    });
    personNoProfileId = noProfile.id;

    const rateLimit = await prisma.person.create({
      data: { fullName: 'Candidato Rate Limit Int', status: 'ATIVO' },
      select: { id: true },
    });
    personRateLimitId = rateLimit.id;
    await prisma.candidateProfile.create({ data: { personId: personRateLimitId } });
    await prisma.consent.create({
      data: {
        personId: personRateLimitId,
        purpose: 'CV_AI_EXTRACTION',
        termVersion: 'v1.0',
        termContentHash: 'x',
      },
    });
    // 3 tentativas já hoje — a 4ª deve ser bloqueada (CVE-07 / CVE-MN-04).
    await prisma.cvUploadAttempt.createMany({
      data: [{ personId: personRateLimitId }, { personId: personRateLimitId }, { personId: personRateLimitId }],
    });
  });

  afterAll(async () => {
    const allPersonIds = [
      personWithConsentId,
      personValidationId,
      personNoConsentId,
      personRateLimitId,
    ];
    const storage = createSupabaseStorageClient().from(STORAGE_BUCKETS.CVS);
    for (const personId of allPersonIds) {
      const files = await listStorageFiles(personId);
      if (files.length > 0) {
        await storage.remove(files.map((f) => `${personId}/${f.name}`));
      }
    }
    // `audit_log` é append-only (REVOKE DELETE — ADR-T-0004): não há limpeza
    // possível nem necessária (retenção operacional cobre o purge).
    await prisma.cvUploadAttempt.deleteMany({ where: { personId: { in: allPersonIds } } });
    await prisma.candidateProfile.deleteMany({ where: { personId: { in: allPersonIds } } });
    await prisma.consent.deleteMany({
      where: { personId: { in: [personWithConsentId, personValidationId, personRateLimitId] } },
    });
    await prisma.person.deleteMany({
      where: { id: { in: [...allPersonIds, personNoProfileId] } },
    });
  });

  it('CVE-01 happy path: armazena o arquivo, audita CV_UPLOADED e grava as colunas cv*', async () => {
    mockPerson = baseMockPerson(personWithConsentId);
    const formData = new FormData();
    formData.set('file', pdfFile());

    const res = await uploadCv(formData);
    expect(res.ok).toBe(true);

    const profile = await prisma.candidateProfile.findUnique({
      where: { personId: personWithConsentId },
      select: { cvStoragePath: true, cvSha256: true, cvUploadedAt: true },
    });
    expect(profile?.cvStoragePath).toMatch(new RegExp(`^${personWithConsentId}/`));
    expect(profile?.cvSha256).toHaveLength(64); // sha256 hex
    expect(profile?.cvUploadedAt).toBeInstanceOf(Date);

    const attemptCount = await prisma.cvUploadAttempt.count({
      where: { personId: personWithConsentId },
    });
    expect(attemptCount).toBe(1);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CV_UPLOADED', actorPersonId: personWithConsentId },
    });
    expect(audit).not.toBeNull();

    const files = await listStorageFiles(personWithConsentId);
    expect(files.length).toBe(1);
  });

  it('CVE-01/CVE-MN-02 MIME inválido: rejeita com VALIDATION sem armazenar', async () => {
    mockPerson = baseMockPerson(personValidationId);
    // Bytes aleatórios com nome .pdf — MIME real (não a extensão) decide.
    const notPdf = new File([new Uint8Array([0x00, 0x11, 0x22, 0x33]) as unknown as BlobPart], 'fake.pdf', {
      type: 'application/pdf',
    });
    const formData = new FormData();
    formData.set('file', notPdf);

    const res = await uploadCv(formData);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('VALIDATION');

    const profile = await prisma.candidateProfile.findUnique({
      where: { personId: personValidationId },
      select: { cvStoragePath: true },
    });
    expect(profile?.cvStoragePath).toBeNull();
    expect(await listStorageFiles(personValidationId)).toHaveLength(0);
  });

  it('CVE-01 tamanho: rejeita arquivo >5MB com VALIDATION', async () => {
    mockPerson = baseMockPerson(personValidationId);
    const formData = new FormData();
    formData.set('file', pdfFile(MAX_CV_BYTES + 1));

    const res = await uploadCv(formData);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('VALIDATION');
    expect(await listStorageFiles(personValidationId)).toHaveLength(0);
  });

  it('CVE-06/CVE-MN-03 sem consentimento: bloqueia com CONSENT_REQUIRED sem armazenar', async () => {
    mockPerson = baseMockPerson(personNoConsentId);
    const formData = new FormData();
    formData.set('file', pdfFile());

    const res = await uploadCv(formData);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('CONSENT_REQUIRED');
    expect(await listStorageFiles(personNoConsentId)).toHaveLength(0);
  });

  it('CVE-07/CVE-MN-04 4º upload no dia: bloqueia com PRECONDITION_FAILED sem armazenar', async () => {
    mockPerson = baseMockPerson(personRateLimitId);
    const formData = new FormData();
    formData.set('file', pdfFile());

    const res = await uploadCv(formData);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('PRECONDITION_FAILED');

    const attemptCount = await prisma.cvUploadAttempt.count({
      where: { personId: personRateLimitId },
    });
    expect(attemptCount).toBe(3); // não incrementou — a 4ª tentativa não foi registrada
    expect(await listStorageFiles(personRateLimitId)).toHaveLength(0);
  });

  it('falha de Storage: retorna INTERNAL sem registrar CV_UPLOADED (nunca lança)', async () => {
    mockPerson = baseMockPerson(personWithConsentId);
    storageOverride.fn = () => ({
      from: () => ({
        upload: async () => ({
          data: null,
          error: { message: 'simulated storage failure', name: 'StorageApiError' },
        }),
      }),
    });

    try {
      const formData = new FormData();
      formData.set('file', pdfFile());
      const res = await uploadCv(formData);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error.code).toBe('INTERNAL');

      // A tentativa anterior (happy path) já criou 1 CvUploadAttempt; a falha
      // de Storage não deve ter criado uma 2ª linha.
      const attemptCount = await prisma.cvUploadAttempt.count({
        where: { personId: personWithConsentId },
      });
      expect(attemptCount).toBe(1);
    } finally {
      storageOverride.fn = null;
    }
  });

  it('precondição: sem candidate_profiles bloqueia com PRECONDITION_FAILED', async () => {
    mockPerson = baseMockPerson(personNoProfileId);
    const formData = new FormData();
    formData.set('file', pdfFile());

    const res = await uploadCv(formData);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('PRECONDITION_FAILED');
  });

  it('não autenticado: bloqueia com UNAUTHENTICATED', async () => {
    mockPerson = null;
    const formData = new FormData();
    formData.set('file', pdfFile());

    const res = await uploadCv(formData);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('UNAUTHENTICATED');
  });

  it('sem arquivo: bloqueia com VALIDATION', async () => {
    mockPerson = baseMockPerson(personWithConsentId);
    const formData = new FormData();

    const res = await uploadCv(formData);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('VALIDATION');
  });
});
