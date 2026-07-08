import type { PrismaClient } from '@prisma/client';
import { SYSTEM_ACTOR_ID } from '../../src/shared/system-actor';

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
 *
 * Também semeia os itens da checklist de verificação de Empresa (F0B-01 /
 * B-004 / F0-MN-04): fonte canônica `docs/operacao/checklist-empresa-fantasma.md`
 * (critérios eliminatórios A1-A4 + presença B1-B4). Idempotente por `code`
 * (`@unique`). Conteúdo **definitivo** é gate de go-live (sponsor + coordenador
 * + PO) — este é o seed inicial de trabalho, lido por
 * `listVerificationChecklistItems()` (`@/modules/moderation`).
 */

/** Regiões (bairros do norte da Ilha de Florianópolis) + opção abrangente. */
export const REGIONS: ReadonlyArray<string> = [
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
export const JOB_AREAS: ReadonlyArray<string> = [
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
export const SERVICE_CATEGORIES: ReadonlyArray<string> = [
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

/** Item da checklist de verificação de Empresa (seed inicial de trabalho). */
interface ChecklistItemSeed {
  code: string;
  section: 'A' | 'B';
  label: string;
  guidance: string;
  isBlocking: boolean;
  order: number;
}

const CHECKLIST_ITEMS: ReadonlyArray<ChecklistItemSeed> = [
  {
    code: 'A1',
    section: 'A',
    label: 'CNPJ válido e ativo',
    guidance:
      'Consultar situação cadastral na Receita Federal (ou base pública equivalente). Situação deve ser "ATIVA".',
    isBlocking: true,
    order: 1,
  },
  {
    code: 'A2',
    section: 'A',
    label: 'Razão social compatível com o CNPJ',
    guidance: 'A razão social/nome fantasia informado bate com o registro da Receita.',
    isBlocking: true,
    order: 2,
  },
  {
    code: 'A3',
    section: 'A',
    label: 'Coerência razão social × atividade (CNAE) × vaga',
    guidance: 'A atividade econômica registrada é compatível com o tipo de vaga anunciada.',
    isBlocking: true,
    order: 3,
  },
  {
    code: 'A4',
    section: 'A',
    label: 'Sem cobrança ao candidato',
    guidance:
      'A vaga/empresa não pede pagamento, depósito, compra de kit ou "taxa de cadastro" ao candidato.',
    isBlocking: true,
    order: 4,
  },
  {
    code: 'B1',
    section: 'B',
    label: 'Contato verificável',
    guidance:
      'Telefone e/ou e-mail corporativo respondem; e-mail preferencialmente em domínio próprio (não só Gmail/Hotmail).',
    isBlocking: false,
    order: 5,
  },
  {
    code: 'B2',
    section: 'B',
    label: 'Endereço plausível',
    guidance: 'Endereço informado existe e é compatível com a região atendida ou com a sede declarada.',
    isBlocking: false,
    order: 6,
  },
  {
    code: 'B3',
    section: 'B',
    label: 'Presença digital mínima',
    guidance:
      'Site, rede social ativa, ou registro em diretórios locais. Histórico coerente (não criado "ontem").',
    isBlocking: false,
    order: 7,
  },
  {
    code: 'B4',
    section: 'B',
    label: 'Responsável identificável',
    guidance: 'Existe pessoa de contato com nome e papel na empresa.',
    isBlocking: false,
    order: 8,
  },
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

async function seedVerificationChecklistItems(prisma: PrismaClient): Promise<number> {
  for (const item of CHECKLIST_ITEMS) {
    const data = {
      section: item.section,
      label: item.label,
      guidance: item.guidance,
      isBlocking: item.isBlocking,
      order: item.order,
      isActive: true,
    };
    await prisma.verificationChecklistItem.upsert({
      where: { code: item.code },
      update: data,
      create: { code: item.code, ...data },
    });
  }
  return CHECKLIST_ITEMS.length;
}

/**
 * Ator de sistema (USP-024 / T3): Pessoa mínima usada como `actorPersonId` pelo
 * job de expiração automática (`SYSTEM_JOB`, sem operador humano). `id` fixo
 * (`SYSTEM_ACTOR_ID`) via `upsert` por PK — idempotente, prod-safe.
 */
async function seedSystemActor(prisma: PrismaClient): Promise<void> {
  await prisma.person.upsert({
    where: { id: SYSTEM_ACTOR_ID },
    update: {},
    create: {
      id: SYSTEM_ACTOR_ID,
      fullName: 'Sistema (job automático)',
      status: 'ATIVO',
    },
  });
}

export interface ReferenceSeedResult {
  regions: number;
  jobAreas: number;
  serviceCategories: number;
  verificationChecklistItems: number;
}

/** Semeia toda a taxonomia de referência (prod-safe, idempotente). */
export async function seedReference(prisma: PrismaClient): Promise<ReferenceSeedResult> {
  const [regions, jobAreas, serviceCategories, verificationChecklistItems] = await Promise.all([
    seedRegions(prisma),
    seedJobAreas(prisma),
    seedServiceCategories(prisma),
    seedVerificationChecklistItems(prisma),
  ]);
  await seedSystemActor(prisma);
  return { regions, jobAreas, serviceCategories, verificationChecklistItems };
}
