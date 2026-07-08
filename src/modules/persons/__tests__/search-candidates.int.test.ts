import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `searchCandidates` (USP-028 / CAN-04). Requer Postgres
 * local (`supabase start`) + extensão unaccent (migração USP-021, reusada pela
 * USP-028). Cobre o gate on-read (USP028-MN-03), os filtros AND (E-002), a busca
 * sem acento, a paginação (USP028-MN-04), authz (USP028-08), estado vazio e o
 * sensor de discriminação de PII/sobrenome (USP028-MN-01/MN-02/MN-05).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { searchCandidates, SEARCH_PAGE_SIZE } = await import('../queries/search-candidates');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const AREA_NAME = 'Busca Candidatos Int Área';
const OTHER_AREA_NAME = 'Busca Candidatos Int Área B';
const REGION_A = 'Busca Candidatos Int Região A';
const REGION_B = 'Busca Candidatos Int Região B';

const CPF_SENSOR = '75456780090';
const ENDERECO_SENSOR = 'Rua Sensível Busca Candidatos Int, 77';
const SOBRENOME_SENSOR = 'SobrenomeSensorBuscaCandidatosInt';
const EMAIL_SENSOR = 'sensor.busca.candidatos.int@example.com';
const PHONE_SENSOR = '11977776666';
const CV_SENSOR = 'busca-candidatos-int/cv-sensor.pdf';

const responsible: CurrentPerson = {
  id: 'viewer-responsible',
  supabaseUserId: '00000000-0000-0000-0000-0000000000cc',
  fullName: 'Responsável Busca Int',
  status: 'ATIVO',
  primeiroAcesso: false,
  roles: ['COMPANY_RESPONSIBLE'],
  phone: null,
  fullAddress: null,
};

const nonResponsible: CurrentPerson = { ...responsible, id: 'viewer-not-responsible', roles: ['CANDIDATE'] };

skipIfNoDb('searchCandidates — integração', () => {
  let areaId = '';
  let otherAreaId = '';
  let regionAId = '';
  let regionBId = '';

  let cRecente = ''; // ACTIVE/ATIVO, área A, região A, mais recente
  let cAntigo = ''; // ACTIVE/ATIVO, área B, região B, mais antigo
  let cDraft = ''; // DRAFT — excluído (MN-03)
  let cInModeration = ''; // IN_MODERATION — excluído (MN-03)
  let cPessoaInativa = ''; // ACTIVE mas Person.status=INATIVO — excluído (MN-03)
  let cSensor = ''; // ACTIVE/ATIVO com PII semeada (sensor MN-01/MN-02/MN-05)
  const paginationIds: string[] = [];

  async function cleanup() {
    await prisma.candidateProfile.deleteMany({ where: { person: { fullName: { startsWith: 'Busca Candidatos Int' } } } });
    await prisma.person.deleteMany({ where: { fullName: { startsWith: 'Busca Candidatos Int' } } });
    await prisma.jobArea.deleteMany({ where: { name: { in: [AREA_NAME, OTHER_AREA_NAME] } } });
    await prisma.region.deleteMany({ where: { name: { in: [REGION_A, REGION_B] } } });
  }

  beforeAll(async () => {
    await cleanup();

    const [area, otherArea] = await Promise.all([
      prisma.jobArea.upsert({ where: { name: AREA_NAME }, update: {}, create: { name: AREA_NAME }, select: { id: true } }),
      prisma.jobArea.upsert({ where: { name: OTHER_AREA_NAME }, update: {}, create: { name: OTHER_AREA_NAME }, select: { id: true } }),
    ]);
    areaId = area.id;
    otherAreaId = otherArea.id;

    const [ra, rb] = await Promise.all([
      prisma.region.upsert({ where: { name: REGION_A }, update: {}, create: { name: REGION_A, cityName: 'Florianópolis' }, select: { id: true } }),
      prisma.region.upsert({ where: { name: REGION_B }, update: {}, create: { name: REGION_B, cityName: 'São José' }, select: { id: true } }),
    ]);
    regionAId = ra.id;
    regionBId = rb.id;

    async function makeCandidate(opts: {
      name: string;
      personStatus: 'ATIVO' | 'INATIVO';
      publicationStatus: 'DRAFT' | 'IN_MODERATION' | 'ACTIVE';
      areaId: string;
      regionId: string | null;
      createdAt: Date;
      headline?: string | null;
      skillsText?: string | null;
      educationLevel?: string | null;
      availability?: string | null;
      extra?: { cpf?: string; fullAddress?: string; emailLogin?: string; phone?: string };
    }): Promise<string> {
      const person = await prisma.person.create({
        data: { fullName: opts.name, status: opts.personStatus, ...opts.extra },
        select: { id: true },
      });
      await prisma.candidateProfile.create({
        data: {
          personId: person.id,
          publicationStatus: opts.publicationStatus,
          primaryAreaOfInterestId: opts.areaId,
          regionId: opts.regionId,
          headline: opts.headline ?? null,
          skillsText: opts.skillsText ?? null,
          educationLevel: opts.educationLevel ?? 'ENSINO_MEDIO',
          availability: opts.availability ?? 'Período integral',
          createdAt: opts.createdAt,
        },
      });
      return person.id;
    }

    const now = new Date();
    const earlier = new Date(now.getTime() - 60_000);

    cRecente = await makeCandidate({
      name: 'Busca Candidatos Int Recente',
      personStatus: 'ATIVO',
      publicationStatus: 'ACTIVE',
      areaId,
      regionId: regionAId,
      createdAt: now,
      headline: 'Auxiliar administrativo buscacandidatosintunico',
      availability: 'Período integral',
    });
    cAntigo = await makeCandidate({
      name: 'Busca Candidatos Int Antigo',
      personStatus: 'ATIVO',
      publicationStatus: 'ACTIVE',
      areaId: otherAreaId,
      regionId: regionBId,
      createdAt: earlier,
      headline: null,
      skillsText: 'Vendas',
      availability: 'Meio período',
    });
    cDraft = await makeCandidate({
      name: 'Busca Candidatos Int Draft',
      personStatus: 'ATIVO',
      publicationStatus: 'DRAFT',
      areaId,
      regionId: regionAId,
      createdAt: now,
    });
    cInModeration = await makeCandidate({
      name: 'Busca Candidatos Int Moderacao',
      personStatus: 'ATIVO',
      publicationStatus: 'IN_MODERATION',
      areaId,
      regionId: regionAId,
      createdAt: now,
    });
    cPessoaInativa = await makeCandidate({
      name: 'Busca Candidatos Int Pessoa Inativa',
      personStatus: 'INATIVO',
      publicationStatus: 'ACTIVE',
      areaId,
      regionId: regionAId,
      createdAt: now,
    });
    cSensor = await makeCandidate({
      name: `Busca Candidatos Int Ana ${SOBRENOME_SENSOR}`,
      personStatus: 'ATIVO',
      publicationStatus: 'ACTIVE',
      areaId,
      regionId: regionAId,
      createdAt: now,
      extra: { cpf: CPF_SENSOR, fullAddress: ENDERECO_SENSOR, emailLogin: EMAIL_SENSOR, phone: PHONE_SENSOR },
    });
    await prisma.candidateProfile.update({ where: { personId: cSensor }, data: { cvStoragePath: CV_SENSOR } });

    // Fixtures de paginação: SEARCH_PAGE_SIZE + 5 candidatos ACTIVE/ATIVO extras na área A.
    for (let i = 0; i < SEARCH_PAGE_SIZE + 5; i += 1) {
      const id = await makeCandidate({
        name: `Busca Candidatos Int Paginacao ${i}`,
        personStatus: 'ATIVO',
        publicationStatus: 'ACTIVE',
        areaId,
        regionId: null,
        createdAt: new Date(now.getTime() - (i + 1) * 1000),
      });
      paginationIds.push(id);
    }
  });

  afterAll(async () => {
    await cleanup();
  });

  it('USP028-01: lista só perfis ACTIVE/ATIVO, ordenados por cadastro (mais recentes primeiro)', async () => {
    // Sem filtro, o dataset de fixtures tem 28 candidatos ACTIVE/ATIVO (SEARCH_PAGE_SIZE+5 de
    // paginação + cRecente + cSensor + cAntigo) — junta 2 páginas p/ verificar a ordem geral,
    // já que cAntigo (criado 60s antes) fica fora do top 20 por si só (coberto por MN-04 à parte).
    const [page1, page2] = await Promise.all([
      searchCandidates({}, responsible),
      searchCandidates({ page: 2 }, responsible),
    ]);
    expect(page1.ok).toBe(true);
    expect(page2.ok).toBe(true);
    if (!page1.ok || !page2.ok) return;

    const ids = [...page1.data.items, ...page2.data.items].map((i) => i.candidatePersonId);
    expect(ids).toContain(cRecente);
    expect(ids).toContain(cAntigo);
    expect(ids.indexOf(cRecente)).toBeLessThan(ids.indexOf(cAntigo)); // mais recente primeiro
  });

  it('USP028-MN-03: exclui DRAFT, IN_MODERATION e Pessoa INATIVO', async () => {
    const res = await searchCandidates({}, responsible);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const ids = res.data.items.map((i) => i.candidatePersonId);
    expect(ids).not.toContain(cDraft);
    expect(ids).not.toContain(cInModeration);
    expect(ids).not.toContain(cPessoaInativa);
  });

  it('USP028-02: filtro por área (AND implícito de 1 filtro)', async () => {
    const res = await searchCandidates({ areaId: otherAreaId }, responsible);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ids = res.data.items.map((i) => i.candidatePersonId);
    expect(ids).toContain(cAntigo);
    expect(ids).not.toContain(cRecente);
  });

  it('USP028-02: filtro por região', async () => {
    const res = await searchCandidates({ regionId: regionBId }, responsible);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ids = res.data.items.map((i) => i.candidatePersonId);
    expect(ids).toContain(cAntigo);
    expect(ids).not.toContain(cRecente);
  });

  it('USP028-02: filtro por disponibilidade (unaccent contains)', async () => {
    const res = await searchCandidates({ availability: 'periodo integral' }, responsible);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ids = res.data.items.map((i) => i.candidatePersonId);
    expect(ids).toContain(cRecente); // "Período integral" casa "periodo integral" sem acento
    expect(ids).not.toContain(cAntigo); // "Meio período"
  });

  it('USP028-02: combinação de filtros em AND (área + região)', async () => {
    const res = await searchCandidates({ areaId, regionId: regionAId }, responsible);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ids = res.data.items.map((i) => i.candidatePersonId);
    expect(ids).toContain(cRecente);
    expect(ids).not.toContain(cAntigo); // área/região diferentes
  });

  it('busca textual é sem acento e case-insensitive', async () => {
    for (const term of ['buscacandidatosintunico', 'BUSCACANDIDATOSINTUNICO']) {
      const res = await searchCandidates({ q: term }, responsible);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.data.items.map((i) => i.candidatePersonId)).toContain(cRecente);
    }
  });

  it('USP028-MN-04: pagina no banco — nunca retorna mais que SEARCH_PAGE_SIZE por chamada', async () => {
    const res = await searchCandidates({ areaId }, responsible);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.items.length).toBeLessThanOrEqual(SEARCH_PAGE_SIZE);
    // área A tem: cRecente + cDraft(excluído) + cInModeration(excluído) +
    // cPessoaInativa(excluído) + cSensor + (SEARCH_PAGE_SIZE+5) de paginação = SEARCH_PAGE_SIZE+7 ativos.
    expect(res.data.total).toBe(SEARCH_PAGE_SIZE + 7);

    const page2 = await searchCandidates({ areaId, page: 2 }, responsible);
    expect(page2.ok).toBe(true);
    if (!page2.ok) return;
    expect(page2.data.items.length).toBeGreaterThan(0); // sobra pelo menos 1 na página 2
  });

  it('USP028-08: não-responsável recebe FORBIDDEN, sem candidatos', async () => {
    const res = await searchCandidates({}, nonResponsible);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('FORBIDDEN');
  });

  it('USP028-07: filtro sem nenhum resultado retorna lista vazia (sem erro)', async () => {
    const res = await searchCandidates({ q: 'termoQueNaoExisteEmNenhumPerfilBuscaCandidatosInt' }, responsible);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.items).toEqual([]);
    expect(res.data.total).toBe(0);
  });

  it('USP028-MN-01/MN-02/MN-05 sensor: CPF, e-mail, telefone, endereço, CV e sobrenome NÃO aparecem no payload serializado', async () => {
    const res = await searchCandidates({ areaId }, responsible);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const sensorItem = res.data.items.find((i) => i.candidatePersonId === cSensor);
    expect(sensorItem).toBeDefined();
    expect(sensorItem?.firstName).toBe('Busca'); // só o 1º token do fullName

    const serialized = JSON.stringify(res.data);
    expect(serialized).not.toContain(CPF_SENSOR);
    expect(serialized).not.toContain(EMAIL_SENSOR);
    expect(serialized).not.toContain(PHONE_SENSOR);
    expect(serialized).not.toContain(ENDERECO_SENSOR);
    expect(serialized).not.toContain(CV_SENSOR);
    expect(serialized).not.toContain(SOBRENOME_SENSOR);
  });
});
