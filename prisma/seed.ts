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

async function main(): Promise<void> {
  const [regions, jobAreas, serviceCategories] = await Promise.all([
    seedRegions(),
    seedJobAreas(),
    seedServiceCategories(),
  ]);

  console.log('Seed de taxonomia concluído (idempotente):');
  console.log(`  regions:            ${regions}`);
  console.log(`  job_areas:          ${jobAreas}`);
  console.log(`  service_categories: ${serviceCategories}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
