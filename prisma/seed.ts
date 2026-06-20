import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed da taxonomia inicial (US #111).
 *
 * Fonte canônica das listas: docs/operacao/taxonomia-inicial.md
 * Idempotente: usa `upsert` por `name` (campo @unique) — re-rodar não duplica.
 */

/** Regiões (bairros do norte da Ilha de Florianópolis) + opção abrangente. */
const REGIONS: ReadonlyArray<string> = [
  'Canasvieiras',
  'Jurerê',
  'Ingleses',
  'Cachoeira do Bom Jesus',
  'Ponta das Canas',
  'Praia Brava',
  'Vargem do Bom Jesus',
  'Santinho',
  'Daniela',
  'Toda Florianópolis',
];

/** Áreas de vaga iniciais (aprovadas). */
const JOB_AREAS: ReadonlyArray<string> = [
  'Administrativa',
  'Comércio e Vendas',
  'Alimentação e Gastronomia',
  'Turismo e Hotelaria',
  'Saúde',
  'Limpeza e Conservação',
  'Construção e Reformas',
  'Logística e Transporte',
  'Beleza e Estética',
  'Educação',
  'Tecnologia',
  'Serviços Gerais',
];

/** Categorias de serviço iniciais (aprovadas). */
const SERVICE_CATEGORIES: ReadonlyArray<string> = [
  'Serviços Domésticos',
  'Reparos e Manutenção',
  'Área Externa e Jardinagem',
  'Beleza e Bem-estar',
  'Aulas e Reforço',
  'Cuidados (idosos, crianças, pets)',
  'Eventos e Buffet',
  'Tecnologia e Informática',
  'Costura e Confecção',
  'Transporte e Fretes',
];

async function seedRegions(): Promise<number> {
  for (const name of REGIONS) {
    await prisma.region.upsert({
      where: { name },
      update: { cityName: 'Florianópolis', state: 'SC', isActive: true },
      create: { name, cityName: 'Florianópolis', state: 'SC', isActive: true },
    });
  }
  return REGIONS.length;
}

async function seedJobAreas(): Promise<number> {
  for (const name of JOB_AREAS) {
    await prisma.jobArea.upsert({
      where: { name },
      update: { isSuggestion: false },
      create: { name, isSuggestion: false },
    });
  }
  return JOB_AREAS.length;
}

async function seedServiceCategories(): Promise<number> {
  for (const name of SERVICE_CATEGORIES) {
    await prisma.serviceCategory.upsert({
      where: { name },
      update: { isSuggestion: false },
      create: { name, isSuggestion: false },
    });
  }
  return SERVICE_CATEGORIES.length;
}

// ── Vagas de demonstração (USP-021) ────────────────────────────────────────────
// A busca pública (`/vagas`) só tem o que mostrar se houver vagas ACTIVE de uma
// Empresa verificada. Sem isso o E2E de descoberta (T3) e o dev local ficam vazios.
// IDs fixos → idempotente (upsert). Pessoa autora sem credencial Supabase (permitido).

const DEMO_AUTHOR_ID = '00000000-0000-0000-0000-0000000000a1';
const DEMO_COMPANY_ID = '00000000-0000-0000-0000-0000000000c1';
const DEMO_COMPANY_CNPJ = '11444777000161';
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
];

async function seedDemoJobs(): Promise<number> {
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
      validUntil,
      publishedAt,
      status: 'ACTIVE' as const,
    };
    await prisma.job.upsert({ where: { id: job.id }, update: data, create: { id: job.id, ...data } });
    count += 1;
  }
  return count;
}

async function main(): Promise<void> {
  const [regions, jobAreas, serviceCategories] = await Promise.all([
    seedRegions(),
    seedJobAreas(),
    seedServiceCategories(),
  ]);

  // Depende das taxonomias acima (área/região por nome).
  const demoJobs = await seedDemoJobs();

  console.log('Seed de taxonomia concluído (idempotente):');
  console.log(`  regions:            ${regions}`);
  console.log(`  job_areas:          ${jobAreas}`);
  console.log(`  service_categories: ${serviceCategories}`);
  console.log(`  demo_jobs (ACTIVE): ${demoJobs}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
