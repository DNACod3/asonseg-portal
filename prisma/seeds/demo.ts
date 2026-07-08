import type { PrismaClient } from '@prisma/client';

/**
 * Seed de **demo** (US #111 / F0A-03 — Fase 0 — Fundação).
 *
 * Dados fictícios **dev-only** (nunca rodam em produção): vagas de demonstração
 * (USP-021) e candidaturas de backfill (USP-022). Depende do seed de
 * referência (`prisma/seeds/reference.ts`) já ter rodado — usa `areaId`/
 * `regionId` resolvidos por nome.
 */

// ── Vagas de demonstração (USP-021) ────────────────────────────────────────────
// A busca pública (`/vagas`) só tem o que mostrar se houver vagas ACTIVE de uma
// Empresa verificada. Sem isso o E2E de descoberta (T3) e o dev local ficam vazios.
// IDs fixos → idempotente (upsert). Pessoa autora sem credencial Supabase (permitido).

const DEMO_AUTHOR_ID = '00000000-0000-0000-0000-0000000000a1';
const DEMO_COMPANY_ID = '00000000-0000-0000-0000-0000000000c1';
// CNPJ exclusivo do seed — NÃO reutilizar em fixtures de teste: os testes de
// integração de jobs fazem cleanup por CNPJ e apagariam estas vagas de demo
// (e quebrariam o E2E de descoberta, que roda no mesmo job/DB no CI).
const DEMO_COMPANY_CNPJ = '11444777000242';
const DEMO_COMPANY_SETOR = 'Comércio e Vendas';

/** yyyy-MM-dd deslocado `days` dias de hoje (validade/publicação das vagas demo). */
function dateOffset(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

interface DemoJob {
  id: string;
  title: string;
  areaName: string;
  regionName: string;
  description: string;
  requirements: string;
  workRegime: string;
  contractType: string;
  location: string;
  educationLevelRequired: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryVisible: boolean;
  /** Override do status padrão (`ACTIVE`) — fixtures de estado p/ E2E público (USP-023/024). */
  status?: 'ACTIVE' | 'PAUSED' | 'EXPIRED';
  /** Override do offset padrão de `validUntil` (+90 dias) — vaga expirada precisa de data passada. */
  validUntilOffsetDays?: number;
}

const DEMO_JOBS: ReadonlyArray<DemoJob> = [
  {
    id: '00000000-0000-0000-0000-00000000d001',
    title: 'Atendente de padaria',
    areaName: 'Alimentação e Gastronomia',
    regionName: 'Canasvieiras',
    description: 'Atendimento ao cliente no balcão da padaria e organização das vitrines.',
    requirements: 'Experiência com atendimento ao público. Disponibilidade para fim de semana.',
    workRegime: 'Presencial',
    contractType: 'CLT',
    location: 'Canasvieiras - Florianópolis/SC',
    educationLevelRequired: 'Ensino fundamental completo',
    salaryMin: 1800,
    salaryMax: 2200,
    salaryVisible: true,
  },
  {
    id: '00000000-0000-0000-0000-00000000d002',
    title: 'Vendedor(a) de loja',
    areaName: 'Comércio e Vendas',
    regionName: 'Ingleses',
    description: 'Vendas no varejo, reposição de mercadorias e fechamento de caixa.',
    requirements: 'Boa comunicação. Experiência em vendas é um diferencial.',
    workRegime: 'Presencial',
    contractType: 'CLT',
    location: 'Ingleses - Florianópolis/SC',
    educationLevelRequired: 'Ensino médio completo',
    salaryMin: 2000,
    salaryMax: 2800,
    salaryVisible: true,
  },
  {
    id: '00000000-0000-0000-0000-00000000d003',
    title: 'Recepcionista de pousada',
    areaName: 'Turismo e Hotelaria',
    regionName: 'Jurerê',
    description: 'Recepção de hóspedes, check-in/check-out e suporte durante a estadia.',
    requirements: 'Inglês básico. Experiência em hotelaria desejável.',
    workRegime: 'Presencial',
    contractType: 'Temporário',
    location: 'Jurerê - Florianópolis/SC',
    educationLevelRequired: 'Ensino médio completo',
    salaryMin: 2400,
    salaryMax: 2400,
    // edge: salário não exibido na vaga pública (salaryVisible=false)
    salaryVisible: false,
  },
  {
    id: '00000000-0000-0000-0000-00000000d004',
    title: 'Auxiliar de limpeza',
    areaName: 'Limpeza e Conservação',
    regionName: 'Toda Florianópolis',
    description: 'Limpeza e conservação de áreas comuns e quartos.',
    requirements: 'Não exige experiência prévia.',
    workRegime: 'Presencial',
    contractType: 'PJ',
    location: 'Toda Florianópolis',
    educationLevelRequired: null,
    salaryMin: null,
    salaryMax: null,
    salaryVisible: true,
  },
  {
    // Vaga PAUSED de demonstração — fixture pública p/ o E2E do detalhe de vaga
    // pausada (USP-023/T7/P-003): `/vagas/[id]` mostra "temporariamente pausada",
    // sem botão candidatar-se. Rota pública, sem necessidade de sessão.
    id: '00000000-0000-0000-0000-00000000d005',
    title: 'Auxiliar de eventos (vaga pausada — demo)',
    areaName: 'Turismo e Hotelaria',
    regionName: 'Jurerê',
    description: 'Vaga de demonstração pausada pela Empresa (fixture de teste E2E).',
    requirements: 'N/A (fixture de teste).',
    workRegime: 'Presencial',
    contractType: 'Temporário',
    location: 'Jurerê - Florianópolis/SC',
    educationLevelRequired: null,
    salaryMin: null,
    salaryMax: null,
    salaryVisible: false,
    status: 'PAUSED',
  },
  {
    // Vaga EXPIRED de demonstração — fixture pública p/ o E2E de expiração
    // automática (USP-024/T3/T5/P-001): some da busca (`/vagas`) e o detalhe
    // (`/vagas/[id]`) mostra "vaga encerrada". Simula o estado pós-cron sem
    // depender do job periódico rodar durante o teste.
    id: '00000000-0000-0000-0000-00000000d006',
    title: 'Estoquista (vaga expirada — demo)',
    areaName: 'Logística e Transporte',
    regionName: 'Toda Florianópolis',
    description: 'Vaga de demonstração já expirada (fixture de teste E2E).',
    requirements: 'N/A (fixture de teste).',
    workRegime: 'Presencial',
    contractType: 'CLT',
    location: 'Toda Florianópolis',
    educationLevelRequired: null,
    salaryMin: null,
    salaryMax: null,
    salaryVisible: false,
    status: 'EXPIRED',
    validUntilOffsetDays: -5,
  },
];

async function seedDemoJobs(prisma: PrismaClient): Promise<number> {
  // Autora sem credencial (Pessoa criada pela AS — supabaseUserId nulo).
  await prisma.person.upsert({
    where: { id: DEMO_AUTHOR_ID },
    update: { fullName: 'Equipe ASONSEG (demo)' },
    create: { id: DEMO_AUTHOR_ID, fullName: 'Equipe ASONSEG (demo)', status: 'ATIVO' },
  });

  // Empresa verificada (P-005: só Empresa verificada aparece na busca pública).
  await prisma.company.upsert({
    where: { cnpj: DEMO_COMPANY_CNPJ },
    update: { isVerified: true, setor: DEMO_COMPANY_SETOR },
    create: {
      id: DEMO_COMPANY_ID,
      cnpj: DEMO_COMPANY_CNPJ,
      razaoSocial: 'Comércio Guadalupe LTDA (demo)',
      nomeFantasia: 'Lojas Guadalupe (demo)',
      setor: DEMO_COMPANY_SETOR,
      isVerified: true,
      createdBy: DEMO_AUTHOR_ID,
    },
  });

  const [areas, regions] = await Promise.all([
    prisma.jobArea.findMany({ select: { id: true, name: true } }),
    prisma.region.findMany({ select: { id: true, name: true } }),
  ]);
  const areaByName = new Map(areas.map((a) => [a.name, a.id]));
  const regionByName = new Map(regions.map((r) => [r.name, r.id]));

  const publishedAt = dateOffset(-2); // publicada há 2 dias
  const validUntil = dateOffset(90); // válida por ~3 meses (on-read E-001/P-003)

  let count = 0;
  for (const job of DEMO_JOBS) {
    const data = {
      companyId: DEMO_COMPANY_ID,
      authorPersonId: DEMO_AUTHOR_ID,
      title: job.title,
      areaId: areaByName.get(job.areaName) ?? null,
      regionId: regionByName.get(job.regionName) ?? null,
      description: job.description,
      requirements: job.requirements,
      workRegime: job.workRegime,
      contractType: job.contractType,
      location: job.location,
      educationLevelRequired: job.educationLevelRequired,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryVisible: job.salaryVisible,
      validUntil: job.validUntilOffsetDays !== undefined ? dateOffset(job.validUntilOffsetDays) : validUntil,
      publishedAt,
      status: job.status ?? 'ACTIVE',
    };
    await prisma.job.upsert({ where: { id: job.id }, update: data, create: { id: job.id, ...data } });
    // O log de conclusão (`prisma/seed.ts`) rotula esta contagem "(ACTIVE)" — só as
    // vagas ACTIVE entram (as fixtures PAUSED/EXPIRED de d005/d006 não contam aqui).
    if ((job.status ?? 'ACTIVE') === 'ACTIVE') count += 1;
  }
  return count;
}

// Backfill de candidaturas (USP-022 / AD-012 — só leitura/contagem). O detalhe da vaga
// só mostra o contador a partir do limiar N ≥ 3 (E-003/P-001): por isso a vaga "Vendedor(a)"
// recebe 4 candidaturas ATIVAS (contador visível, D-005) e ainda 1 cancelada (não conta);
// "Atendente de padaria" fica com 0 (contador oculto). IDs fixos → upsert idempotente.

const APPLICANT_IDS = [
  '00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-0000000000e2',
  '00000000-0000-0000-0000-0000000000e3',
  '00000000-0000-0000-0000-0000000000e4',
  '00000000-0000-0000-0000-0000000000e5',
] as const;

const JOB_VENDEDOR_ID = '00000000-0000-0000-0000-00000000d002'; // ≥ 3 candidaturas ativas (contador visível)

interface DemoApplication {
  id: string;
  candidatoId: string;
  jobId: string;
  cancelled: boolean;
}

const DEMO_APPLICATIONS: ReadonlyArray<DemoApplication> = [
  { id: '00000000-0000-0000-0000-00000000a001', candidatoId: APPLICANT_IDS[0], jobId: JOB_VENDEDOR_ID, cancelled: false },
  { id: '00000000-0000-0000-0000-00000000a002', candidatoId: APPLICANT_IDS[1], jobId: JOB_VENDEDOR_ID, cancelled: false },
  { id: '00000000-0000-0000-0000-00000000a003', candidatoId: APPLICANT_IDS[2], jobId: JOB_VENDEDOR_ID, cancelled: false },
  { id: '00000000-0000-0000-0000-00000000a004', candidatoId: APPLICANT_IDS[3], jobId: JOB_VENDEDOR_ID, cancelled: false },
  // Cancelada (cancelledAt != null) → NÃO entra na contagem do contador (E-003).
  { id: '00000000-0000-0000-0000-00000000a005', candidatoId: APPLICANT_IDS[4], jobId: JOB_VENDEDOR_ID, cancelled: true },
];

async function seedDemoApplications(prisma: PrismaClient): Promise<number> {
  // Pessoas candidatas demo (sem credencial — criadas pela AS; supabaseUserId nulo).
  await Promise.all(
    APPLICANT_IDS.map((id, i) =>
      prisma.person.upsert({
        where: { id },
        update: { fullName: `Candidato(a) demo ${i + 1}` },
        create: { id, fullName: `Candidato(a) demo ${i + 1}`, status: 'ATIVO' },
      }),
    ),
  );

  let count = 0;
  for (const app of DEMO_APPLICATIONS) {
    const data = {
      candidatePersonId: app.candidatoId,
      jobId: app.jobId,
      cancelledAt: app.cancelled ? dateOffset(-1) : null,
    };
    await prisma.application.upsert({
      where: { id: app.id },
      update: data,
      create: { id: app.id, ...data },
    });
    count += 1;
  }
  return count;
}

// Perfis de candidato ACTIVE com região (USP-028 / T6): a busca ativa de
// candidatos só tem o que mostrar se houver `CandidateProfile.publicationStatus
// ACTIVE` + `Person.status ATIVO` — e `regionId` populado, já que a coleta de
// região no formulário de cadastro (USP-009) é follow-up fora do escopo (AD-018).
// Reusa 2 das Pessoas candidatas de `APPLICANT_IDS` (já semeadas ATIVO acima) —
// não cria Pessoa nova, só adiciona/atualiza o CandidateProfile.

interface DemoCandidateProfile {
  personId: string;
  headline: string;
  skillsText: string;
  educationLevel: string;
  availability: string;
  areaName: string;
  regionName: string;
}

const DEMO_CANDIDATE_PROFILES: ReadonlyArray<DemoCandidateProfile> = [
  {
    personId: APPLICANT_IDS[0],
    headline: 'Atendente com experiência em vendas e caixa',
    skillsText: 'Atendimento ao público, Excel, Caixa',
    educationLevel: 'ENSINO_MEDIO',
    availability: 'Período integral',
    areaName: 'Comércio e Vendas',
    regionName: 'Ingleses',
  },
  {
    personId: APPLICANT_IDS[1],
    headline: 'Auxiliar de limpeza com disponibilidade imediata',
    skillsText: 'Limpeza e conservação de áreas comuns',
    educationLevel: 'ENSINO_FUNDAMENTAL',
    availability: 'Meio período',
    areaName: 'Limpeza e Conservação',
    regionName: 'Canasvieiras',
  },
];

async function seedDemoCandidateProfiles(prisma: PrismaClient): Promise<number> {
  const [areas, regions] = await Promise.all([
    prisma.jobArea.findMany({ select: { id: true, name: true } }),
    prisma.region.findMany({ select: { id: true, name: true } }),
  ]);
  const areaByName = new Map(areas.map((a) => [a.name, a.id]));
  const regionByName = new Map(regions.map((r) => [r.name, r.id]));

  let count = 0;
  for (const profile of DEMO_CANDIDATE_PROFILES) {
    const data = {
      publicationStatus: 'ACTIVE' as const,
      headline: profile.headline,
      skillsText: profile.skillsText,
      educationLevel: profile.educationLevel,
      availability: profile.availability,
      primaryAreaOfInterestId: areaByName.get(profile.areaName) ?? null,
      regionId: regionByName.get(profile.regionName) ?? null,
    };
    await prisma.candidateProfile.upsert({
      where: { personId: profile.personId },
      update: data,
      create: { personId: profile.personId, ...data },
    });
    count += 1;
  }
  return count;
}

// ── Serviços de demonstração (USP-029/030) ────────────────────────────────────
// A busca pública (`/servicos`) só tem o que mostrar se houver serviços ACTIVE
// de um prestador ativo. Sem isso o E2E de descoberta (USP-030) e o dev local
// ficam vazios. IDs fixos → idempotente (upsert). Autor sem credencial Supabase
// (Pessoa criada pela AS, mesmo padrão de `DEMO_AUTHOR_ID`).

const DEMO_PROVIDER_ID = '00000000-0000-0000-0000-00000000f001';

interface DemoService {
  id: string;
  title: string;
  categoryName: string;
  regionName: string;
  description: string;
  priceMin: number | null;
  priceMax: number | null;
  priceUnit: string | null;
  availabilityDescription: string;
  /** Override do status padrão (`ACTIVE`) — fixture de estado p/ E2E do ciclo de vida (USP-032). */
  status?: 'ACTIVE' | 'PAUSED';
}

const DEMO_SERVICES: ReadonlyArray<DemoService> = [
  {
    id: '00000000-0000-0000-0000-00000000d101',
    title: 'Jardinagem residencial completa',
    categoryName: 'Área Externa e Jardinagem',
    regionName: 'Canasvieiras',
    description: 'Poda, manutenção de grama e jardins residenciais na região norte da Ilha.',
    priceMin: 80,
    priceMax: 150,
    priceUnit: 'por serviço',
    availabilityDescription: 'Segunda a sexta, 8h às 17h.',
  },
  {
    id: '00000000-0000-0000-0000-00000000d102',
    title: 'Aulas de reforço escolar (fundamental)',
    categoryName: 'Aulas e Reforço',
    regionName: 'Ingleses',
    description: 'Aulas particulares de reforço escolar para ensino fundamental, presenciais.',
    priceMin: 50,
    priceMax: 50,
    priceUnit: 'por hora',
    availabilityDescription: 'Tardes, seg. a qui.',
  },
  {
    // Serviço PAUSED de demonstração — fixture pública p/ o E2E do ciclo de vida
    // (USP-032): some da busca (`/servicos`), sem depender de uma ação real
    // durante o teste.
    id: '00000000-0000-0000-0000-00000000d103',
    title: 'Encanador (serviço pausado — demo)',
    categoryName: 'Reparos e Manutenção',
    regionName: 'Toda Florianópolis',
    description: 'Serviço de demonstração pausado pelo prestador (fixture de teste E2E).',
    priceMin: null,
    priceMax: null,
    priceUnit: null,
    availabilityDescription: 'N/A (fixture de teste).',
    status: 'PAUSED',
  },
];

async function seedDemoServices(prisma: PrismaClient): Promise<number> {
  // Prestador sem credencial (Pessoa criada pela AS — supabaseUserId nulo).
  await prisma.person.upsert({
    where: { id: DEMO_PROVIDER_ID },
    update: { fullName: 'Prestador ASONSEG (demo)' },
    create: { id: DEMO_PROVIDER_ID, fullName: 'Prestador ASONSEG (demo)', status: 'ATIVO' },
  });

  const [categories, regions] = await Promise.all([
    prisma.serviceCategory.findMany({ select: { id: true, name: true } }),
    prisma.region.findMany({ select: { id: true, name: true } }),
  ]);
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]));
  const regionByName = new Map(regions.map((r) => [r.name, r.id]));

  const publishedAt = dateOffset(-2); // publicado há 2 dias (mesmo padrão de DEMO_JOBS)

  let count = 0;
  for (const service of DEMO_SERVICES) {
    const data = {
      authorPersonId: DEMO_PROVIDER_ID,
      companyId: null,
      title: service.title,
      categoryId: categoryByName.get(service.categoryName) ?? null,
      regionId: regionByName.get(service.regionName) ?? null,
      description: service.description,
      priceMin: service.priceMin,
      priceMax: service.priceMax,
      priceUnit: service.priceUnit,
      availabilityDescription: service.availabilityDescription,
      publishedAt,
      status: service.status ?? 'ACTIVE',
    };
    await prisma.service.upsert({ where: { id: service.id }, update: data, create: { id: service.id, ...data } });
    // O log de conclusão (`prisma/seed.ts`) rotula esta contagem "(ACTIVE)" — só os
    // serviços ACTIVE entram (a fixture PAUSED de d103 não conta aqui).
    if ((service.status ?? 'ACTIVE') === 'ACTIVE') count += 1;
  }
  return count;
}

export interface DemoSeedResult {
  demoJobs: number;
  demoApplications: number;
  demoCandidateProfiles: number;
  demoServices: number;
}

/** Semeia os dados fictícios de demo (dev-only — nunca chamar em produção). */
export async function seedDemo(prisma: PrismaClient): Promise<DemoSeedResult> {
  // seedDemoJobs depende das taxonomias de referência (área/região por nome).
  const demoJobs = await seedDemoJobs(prisma);
  // seedDemoApplications depende das vagas demo (FK job_id) — contador do detalhe (USP-022 / E-003).
  const demoApplications = await seedDemoApplications(prisma);
  // seedDemoCandidateProfiles depende das Pessoas candidatas (APPLICANT_IDS) acima.
  const demoCandidateProfiles = await seedDemoCandidateProfiles(prisma);
  // seedDemoServices depende das taxonomias de referência (categoria/região por nome).
  const demoServices = await seedDemoServices(prisma);
  return { demoJobs, demoApplications, demoCandidateProfiles, demoServices };
}
