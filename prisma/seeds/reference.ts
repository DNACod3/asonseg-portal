import type { PrismaClient } from '@prisma/client';

/**
 * Seed de **referência** (US #111 / F0A-03 — Fase 0 — Fundação).
 *
 * Dados idempotentes e **prod-safe** (rodam em qualquer ambiente, inclusive
 * produção): taxonomia inicial (regiões, áreas de vaga, categorias de
 * serviço). Fonte canônica das listas: `docs/operacao/taxonomia-inicial.md`.
 * Idempotente: `upsert` por `name` (campo `@unique`) — re-rodar não duplica
 * (F0-MN-01 / AC-111-1).
 *
 * Separado do seed de **demo** (`prisma/seeds/demo.ts`, dev-only) — este
 * arquivo nunca cria vagas/candidaturas/pessoas fictícias.
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

async function seedRegions(prisma: PrismaClient): Promise<number> {
  for (const name of REGIONS) {
    await prisma.region.upsert({
      where: { name },
      update: { cityName: 'Florianópolis', state: 'SC', isActive: true },
      create: { name, cityName: 'Florianópolis', state: 'SC', isActive: true },
    });
  }
  return REGIONS.length;
}

async function seedJobAreas(prisma: PrismaClient): Promise<number> {
  for (const name of JOB_AREAS) {
    await prisma.jobArea.upsert({
      where: { name },
      update: { isSuggestion: false },
      create: { name, isSuggestion: false },
    });
  }
  return JOB_AREAS.length;
}

async function seedServiceCategories(prisma: PrismaClient): Promise<number> {
  for (const name of SERVICE_CATEGORIES) {
    await prisma.serviceCategory.upsert({
      where: { name },
      update: { isSuggestion: false },
      create: { name, isSuggestion: false },
    });
  }
  return SERVICE_CATEGORIES.length;
}

export interface ReferenceSeedResult {
  regions: number;
  jobAreas: number;
  serviceCategories: number;
}

/** Semeia toda a taxonomia de referência (prod-safe, idempotente). */
export async function seedReference(prisma: PrismaClient): Promise<ReferenceSeedResult> {
  const [regions, jobAreas, serviceCategories] = await Promise.all([
    seedRegions(prisma),
    seedJobAreas(prisma),
    seedServiceCategories(prisma),
  ]);
  return { regions, jobAreas, serviceCategories };
}
