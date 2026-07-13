import type { PrismaClient } from '@prisma/client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { TERMS_REGISTRY } from '../../src/modules/consents/domain/terms-registry';
import { isValidCpf } from '../../src/modules/identity/schemas/registerPerson';
import { isValidCnpj } from '../../src/modules/companies/domain/cnpj';

/**
 * Seed de **volume** para validação da plataforma (dev + staging — NUNCA produção).
 *
 * Cria 20-30 registros de cada cadastro de ponta (candidatos, prestadores,
 * clientes, empresas, vagas, serviços, candidaturas, manifestações de interesse,
 * encaminhamentos, fichas socioeconômicas, reivindicações de credencial) + um
 * conjunto pequeno fixo de contas internas (coordenador, assistente social,
 * diretoria, voluntário) para exercitar moderação/delegação/encaminhamento.
 *
 * **Contas login-áveis:** toda Pessoa com papel (exceto as pré-cadastradas do
 * fluxo de reivindicação de credencial) recebe uma credencial real no Supabase
 * Auth com a senha fixa {@link FIXED_PASSWORD}. O e-mail é determinístico
 * (`<prefixo><NN>@<domínio>`) — dá para logar de verdade e validar cada papel.
 *
 * **Idempotente:** todos os `id`/`cnpj`/`cpf`/e-mail são determinísticos e as
 * escritas são `upsert` por PK; as credenciais Auth são reusadas (listagem
 * prévia por e-mail) em vez de recriadas. Re-rodar não duplica.
 *
 * Depende do seed de referência (`prisma/seeds/reference.ts`) já ter rodado —
 * resolve `regionId`/`areaId`/`categoryId` por nome. O gate dev/staging vive em
 * `prisma/seed.ts` (fail-closed em produção); este arquivo re-checa por defesa
 * em profundidade.
 */

// ── Parâmetros ────────────────────────────────────────────────────────────────

/**
 * Senha fixa de todas as contas de teste. Satisfaz a política mais estrita do
 * produto (≥8, ≤128, ≥1 letra, ≥1 número — `changePasswordFirstAccessSchema` /
 * `resetPasswordSchema`), para que as contas de demo consigam trocar/recuperar
 * a própria senha sem que o formulário rejeite a senha semeada (HYG-MN-05).
 * Exportada para reuso no log do seed (`prisma/seed.ts`) e no teste-guarda.
 */
export const FIXED_PASSWORD = 'asonseg2026';
/** Domínio dos e-mails determinísticos. `email_confirm: true` ⇒ nenhum e-mail é enviado. */
const EMAIL_DOMAIN = 'seed.asonseg.dev';

const N_CANDIDATES = 25;
const N_PROVIDERS = 25;
const N_CLIENTS = 25;
const N_COMPANIES = 25;
const N_JOBS = 25;
const N_SERVICES = 25;
const N_APPLICATIONS = 25;
const N_SERVICE_INTERESTS = 25;
const N_REFERRALS = 25;
const N_SOCIOECONOMIC = 25;
const N_CREDENTIAL_CLAIMS = 20;
const N_COORDINATORS = 3;
const N_SOCIAL_ASSISTANTS = 3;
const N_BOARD = 3;
const N_VOLUNTEERS = 3;

// ── Helpers determinísticos ───────────────────────────────────────────────────

/**
 * UUID determinístico e namespaçado (prefixo `5eed…`) — nunca colide com dados
 * reais nem com as fixtures do demo (`00000000-…`). `kind` (4 hex) identifica o
 * tipo de linha; `index` (8 hex) a posição.
 */
function seedUuid(kind: number, index: number): string {
  const k = kind.toString(16).padStart(4, '0');
  const i = index.toString(16).padStart(8, '0');
  return `5eed0000-0000-4000-8000-${k}${i}`;
}

/** Tags de `kind` para {@link seedUuid} (mantêm os `id` agrupados e estáveis). */
const KIND = {
  PERSON_CANDIDATE: 0x0100,
  PERSON_PROVIDER: 0x0200,
  PERSON_CLIENT: 0x0300,
  PERSON_COMPANY_RESP: 0x0400,
  PERSON_COORDINATOR: 0x0501,
  PERSON_SOCIAL_ASSISTANT: 0x0502,
  PERSON_BOARD: 0x0503,
  PERSON_VOLUNTEER: 0x0504,
  PERSON_PRECADASTRADA: 0x0900,
  CREDENTIAL: 0x0010,
  ROLE_GRANT: 0x0011,
  CONSENT_PORTAL: 0x0012,
  CONSENT_PURPOSE: 0x0013,
  COMPANY: 0x0020,
  COMPANY_GRANT: 0x0021,
  JOB: 0x0030,
  SERVICE: 0x0031,
  APPLICATION: 0x0040,
  APPLICATION_REFERRAL: 0x0041,
  SERVICE_INTEREST: 0x0042,
  REFERRAL: 0x0050,
  CREDENTIAL_CLAIM: 0x0070,
  DELEGATED_PERMISSION: 0x0080,
} as const;

/** CPF determinístico e VÁLIDO (dígitos verificadores) — algoritmo de `isValidCpf`. */
function seedCpf(seq: number): string {
  const base = String(900000000 + seq).padStart(9, '0');
  const digits = base.split('').map(Number);
  const calc = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += digits[i]! * (len + 1 - i);
    const rem = (sum * 10) % 11;
    return rem === 10 ? 0 : rem;
  };
  digits.push(calc(9));
  digits.push(calc(10));
  return digits.join('');
}

/** CNPJ determinístico e VÁLIDO (dígitos verificadores) — algoritmo de `isValidCnpj`. */
function seedCnpj(index: number): string {
  const base = String(800000000000 + index).padStart(12, '0');
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const calc = (b: string, w: number[]): number => {
    const sum = b.split('').reduce((acc, d, i) => acc + Number(d) * w[i]!, 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  const d1 = calc(base, w1);
  const d2 = calc(base + d1, w2);
  return `${base}${d1}${d2}`;
}

/** yyyy-MM-dd deslocado `days` dias de hoje (validade/publicação de vagas). */
function dateOffset(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

const FIRST_NAMES = [
  'Ana', 'Bruno', 'Carla', 'Daniel', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique',
  'Isabela', 'João', 'Larissa', 'Marcos', 'Natália', 'Otávio', 'Paula', 'Rafael',
  'Sabrina', 'Thiago', 'Vanessa', 'William', 'Beatriz', 'Caio', 'Débora', 'Elias',
  'Fernanda', 'Gustavo', 'Helena', 'Juliana', 'Kléber', 'Letícia',
] as const;

const LAST_NAMES = [
  'Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Costa', 'Rodrigues', 'Almeida',
  'Nascimento', 'Lima', 'Araújo', 'Fernandes', 'Carvalho', 'Gomes', 'Martins', 'Rocha',
  'Ribeiro', 'Alves', 'Monteiro', 'Cardoso', 'Barbosa', 'Teixeira', 'Correia', 'Dias', 'Moraes',
] as const;

function nameFor(seq: number): string {
  return `${FIRST_NAMES[seq % FIRST_NAMES.length]} ${LAST_NAMES[(seq * 3 + 1) % LAST_NAMES.length]}`;
}

/** Título de vaga + área correspondente (cicla até `N_JOBS`). */
const JOB_TEMPLATES: ReadonlyArray<readonly [string, string]> = [
  ['Auxiliar Administrativo', 'Administrativa'],
  ['Vendedor(a) de Loja', 'Comércio e Vendas'],
  ['Atendente de Balcão', 'Alimentação e Gastronomia'],
  ['Recepcionista', 'Turismo e Hotelaria'],
  ['Auxiliar de Cozinha', 'Alimentação e Gastronomia'],
  ['Camareira', 'Turismo e Hotelaria'],
  ['Auxiliar de Limpeza', 'Limpeza e Conservação'],
  ['Motorista Entregador', 'Logística e Transporte'],
  ['Estoquista', 'Logística e Transporte'],
  ['Operador(a) de Caixa', 'Comércio e Vendas'],
  ['Cuidador(a) de Idosos', 'Saúde'],
  ['Auxiliar de Produção', 'Serviços Gerais'],
  ['Jardineiro(a)', 'Serviços Gerais'],
  ['Pedreiro(a)', 'Construção e Reformas'],
  ['Eletricista', 'Construção e Reformas'],
  ['Cabeleireiro(a)', 'Beleza e Estética'],
  ['Professor(a) de Reforço', 'Educação'],
  ['Assistente de TI', 'Tecnologia'],
  ['Garçom/Garçonete', 'Alimentação e Gastronomia'],
  ['Porteiro(a)', 'Serviços Gerais'],
];

/** Título de serviço + categoria correspondente (cicla até `N_SERVICES`). */
const SERVICE_TEMPLATES: ReadonlyArray<readonly [string, string]> = [
  ['Diarista / Faxina Residencial', 'Serviços Domésticos'],
  ['Reparos Elétricos', 'Reparos e Manutenção'],
  ['Encanador', 'Reparos e Manutenção'],
  ['Jardinagem e Poda', 'Área Externa e Jardinagem'],
  ['Manicure e Pedicure', 'Beleza e Bem-estar'],
  ['Aulas de Reforço (Fundamental)', 'Aulas e Reforço'],
  ['Cuidado de Idosos', 'Cuidados (idosos, crianças, pets)'],
  ['Buffet para Eventos', 'Eventos e Buffet'],
  ['Suporte de Informática', 'Tecnologia e Informática'],
  ['Costura e Ajustes', 'Costura e Confecção'],
  ['Frete e Mudanças', 'Transporte e Fretes'],
  ['Pintura Residencial', 'Reparos e Manutenção'],
  ['Passadeira', 'Serviços Domésticos'],
  ['Corte de Cabelo em Domicílio', 'Beleza e Bem-estar'],
  ['Pet Sitter', 'Cuidados (idosos, crianças, pets)'],
];

type ContentStatusLiteral =
  | 'DRAFT' | 'IN_MODERATION' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'REJECTED';

/** Distribui estados de vaga: maioria ACTIVE + amostras dos demais (valida moderação/expiração). */
function jobStatusFor(i: number): ContentStatusLiteral {
  if (i % 10 === 7) return 'IN_MODERATION';
  if (i % 10 === 8) return 'PAUSED';
  if (i % 10 === 9) return 'EXPIRED';
  if (i % 13 === 5) return 'DRAFT';
  if (i % 17 === 3) return 'REJECTED';
  return 'ACTIVE';
}

function serviceStatusFor(i: number): ContentStatusLiteral {
  if (i % 9 === 8) return 'IN_MODERATION';
  if (i % 11 === 7) return 'PAUSED';
  if (i % 13 === 4) return 'DRAFT';
  return 'ACTIVE';
}

function profileStatusFor(i: number): 'ACTIVE' | 'IN_MODERATION' | 'DRAFT' {
  if (i % 8 === 6) return 'IN_MODERATION';
  if (i % 10 === 9) return 'DRAFT';
  return 'ACTIVE';
}

// ── Cliente admin do Supabase Auth (contexto de seed, sem Next runtime) ────────

/**
 * Constrói o client admin diretamente com `@supabase/supabase-js` (lê
 * `process.env` — o seed roda sob `dotenv -e .env.local|.env.staging`). NÃO
 * reusa `createSupabaseAdminClient()` de `shared/lib/supabase/server` porque
 * aquele módulo importa `next/headers` no topo (indisponível em `tsx`).
 */
function buildAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Seed de volume: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios ' +
        '(rode via `npm run db:seed` / `db:seed:staging`, que carregam o .env correto).',
    );
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Lista todos os usuários Auth existentes → mapa e-mail(lowercase) → id (idempotência). */
async function listAuthUsersByEmail(admin: SupabaseClient): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers falhou: ${error.message}`);
    for (const u of data.users) if (u.email) map.set(u.email.toLowerCase(), u.id);
    if (data.users.length < perPage) break;
  }
  return map;
}

/** Garante a credencial Auth do e-mail (reusa se já existir) e devolve o `supabaseUserId`. */
async function ensureAuthUser(
  admin: SupabaseClient,
  cache: Map<string, string>,
  email: string,
): Promise<string> {
  const key = email.toLowerCase();
  const existing = cache.get(key);
  if (existing) return existing;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: FIXED_PASSWORD,
    email_confirm: true,
  });
  if (!error && data.user) {
    cache.set(key, data.user.id);
    return data.user.id;
  }
  // Corrida / já existe (banco resetado, Auth preservado): re-lista e resolve.
  if (error?.message?.toLowerCase().includes('already') || error?.status === 422) {
    const refreshed = await listAuthUsersByEmail(admin);
    const id = refreshed.get(key);
    if (id) {
      cache.set(key, id);
      return id;
    }
  }
  throw new Error(`createUser falhou para ${email}: ${error?.message ?? 'usuário nulo'}`);
}

/** Concorrência limitada preservando a ordem dos resultados. */
async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

// ── Especificação de Pessoa login-ável ────────────────────────────────────────

type SeededRole =
  | 'CANDIDATE' | 'PROVIDER' | 'CLIENT' | 'COMPANY_RESPONSIBLE'
  | 'COORDINATOR' | 'SOCIAL_ASSISTANT' | 'BOARD' | 'VOLUNTEER';

/** Papel → finalidade de consentimento a semear (além do PORTAL_ACCESS de todos). */
const SEED_ROLE_PURPOSE: Partial<Record<SeededRole, keyof typeof TERMS_REGISTRY>> = {
  CANDIDATE: 'JOB_APPLICATION',
  PROVIDER: 'SERVICE_OFFERING',
  CLIENT: 'SERVICE_HIRING',
  COMPANY_RESPONSIBLE: 'COMPANY_REPRESENTATION',
};

interface PersonSpec {
  seq: number; // índice global único (chaveia credential/grant/consents)
  id: string;
  email: string;
  fullName: string;
  cpf: string;
  role: SeededRole;
}

function buildPersonSpecs(): PersonSpec[] {
  const specs: PersonSpec[] = [];
  let seq = 0;
  const add = (role: SeededRole, kind: number, count: number, prefix: string) => {
    for (let i = 0; i < count; i++) {
      const nn = String(i + 1).padStart(2, '0');
      specs.push({
        seq,
        id: seedUuid(kind, i),
        email: `${prefix}${nn}@${EMAIL_DOMAIN}`,
        fullName: nameFor(seq),
        cpf: seedCpf(seq),
        role,
      });
      seq++;
    }
  };
  add('COORDINATOR', KIND.PERSON_COORDINATOR, N_COORDINATORS, 'coordenador');
  add('SOCIAL_ASSISTANT', KIND.PERSON_SOCIAL_ASSISTANT, N_SOCIAL_ASSISTANTS, 'assistente');
  add('BOARD', KIND.PERSON_BOARD, N_BOARD, 'diretoria');
  add('VOLUNTEER', KIND.PERSON_VOLUNTEER, N_VOLUNTEERS, 'voluntario');
  add('COMPANY_RESPONSIBLE', KIND.PERSON_COMPANY_RESP, N_COMPANIES, 'empresa');
  add('CANDIDATE', KIND.PERSON_CANDIDATE, N_CANDIDATES, 'candidato');
  add('PROVIDER', KIND.PERSON_PROVIDER, N_PROVIDERS, 'prestador');
  add('CLIENT', KIND.PERSON_CLIENT, N_CLIENTS, 'cliente');
  return specs;
}

/** Cria/atualiza Pessoa + Credential + PersonRoleGrant ACTIVE + consents (PORTAL + finalidade). */
async function upsertLoginablePerson(prisma: PrismaClient, spec: PersonSpec, supabaseUserId: string) {
  await prisma.person.upsert({
    where: { id: spec.id },
    update: { supabaseUserId, fullName: spec.fullName, cpf: spec.cpf, emailLogin: spec.email, status: 'ATIVO' },
    create: {
      id: spec.id,
      supabaseUserId,
      fullName: spec.fullName,
      cpf: spec.cpf,
      emailLogin: spec.email,
      status: 'ATIVO',
    },
  });

  await prisma.credential.upsert({
    where: { id: seedUuid(KIND.CREDENTIAL, spec.seq) },
    update: {},
    create: { id: seedUuid(KIND.CREDENTIAL, spec.seq), personId: spec.id, primeiroAcesso: false },
  });

  await prisma.personRoleGrant.upsert({
    where: { id: seedUuid(KIND.ROLE_GRANT, spec.seq) },
    update: { status: 'ACTIVE' },
    create: { id: seedUuid(KIND.ROLE_GRANT, spec.seq), personId: spec.id, role: spec.role, status: 'ACTIVE' },
  });

  // Consentimento PORTAL_ACCESS (base legal mínima de acesso — todos têm).
  await prisma.consent.upsert({
    where: { id: seedUuid(KIND.CONSENT_PORTAL, spec.seq) },
    update: {},
    create: {
      id: seedUuid(KIND.CONSENT_PORTAL, spec.seq),
      personId: spec.id,
      purpose: 'PORTAL_ACCESS',
      termVersion: TERMS_REGISTRY.PORTAL_ACCESS.currentVersion,
      termContentHash: TERMS_REGISTRY.PORTAL_ACCESS.expectedHash,
    },
  });

  // Consentimento da finalidade do papel (quando aplicável — habilita ações gated).
  const purpose = SEED_ROLE_PURPOSE[spec.role];
  if (purpose) {
    await prisma.consent.upsert({
      where: { id: seedUuid(KIND.CONSENT_PURPOSE, spec.seq) },
      update: {},
      create: {
        id: seedUuid(KIND.CONSENT_PURPOSE, spec.seq),
        personId: spec.id,
        purpose,
        termVersion: TERMS_REGISTRY[purpose].currentVersion,
        termContentHash: TERMS_REGISTRY[purpose].expectedHash,
      },
    });
  }
}

// ── Orquestração ──────────────────────────────────────────────────────────────

export interface BulkSeedResult {
  people: number;
  companies: number;
  jobs: number;
  services: number;
  applications: number;
  serviceInterests: number;
  referrals: number;
  socioeconomicRecords: number;
  credentialClaims: number;
  delegatedPermissions: number;
}

/**
 * Semeia o volume de validação. **dev/staging apenas** — o gate de produção vive
 * em `prisma/seed.ts`; assumimos que o chamador já barrou produção.
 */
export async function seedBulk(prisma: PrismaClient): Promise<BulkSeedResult> {
  // Sanidade barata: falha ruidosa se os geradores desviarem dos validadores reais.
  if (!isValidCpf(seedCpf(0)) || !isValidCnpj(seedCnpj(0))) {
    throw new Error('Seed de volume: gerador de CPF/CNPJ produziu documento inválido.');
  }

  const admin = buildAdminClient();
  const authCache = await listAuthUsersByEmail(admin);

  // 1. Pessoas login-áveis (auth em pool; escritas Prisma sequenciais/determinísticas).
  const specs = buildPersonSpecs();
  const authIds = await mapPool(specs, 8, (spec) => ensureAuthUser(admin, authCache, spec.email));
  for (let i = 0; i < specs.length; i++) {
    await upsertLoginablePerson(prisma, specs[i]!, authIds[i]!);
  }

  const byRole = (role: SeededRole) => specs.filter((s) => s.role === role);
  const coordinators = byRole('COORDINATOR');
  const socialAssistants = byRole('SOCIAL_ASSISTANT');
  const volunteers = byRole('VOLUNTEER');
  const companyResponsibles = byRole('COMPANY_RESPONSIBLE');
  const candidates = byRole('CANDIDATE');
  const providers = byRole('PROVIDER');
  const clients = byRole('CLIENT');

  // Taxonomia de referência (resolve id por nome).
  const [regions, areas, categories] = await Promise.all([
    prisma.region.findMany({ select: { id: true, name: true } }),
    prisma.jobArea.findMany({ select: { id: true, name: true } }),
    prisma.serviceCategory.findMany({ select: { id: true, name: true } }),
  ]);
  const areaByName = new Map(areas.map((a) => [a.name, a.id]));
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]));
  const regionAt = (i: number) => regions[i % regions.length]?.id ?? null;

  // 2. Empresas + vínculo do responsável (COMPANY_RESPONSIBLE).
  const companies: { id: string; isVerified: boolean; responsibleId: string }[] = [];
  const companyTypes = ['MEI', 'SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'SA'] as const;
  const setores = ['Comércio e Vendas', 'Alimentação', 'Serviços', 'Turismo e Hotelaria', 'Construção'];
  for (let i = 0; i < N_COMPANIES; i++) {
    const responsible = companyResponsibles[i % companyResponsibles.length]!;
    const isVerified = i % 6 !== 5; // ~1 em 6 não verificada (valida "não aparece na busca")
    const companyId = seedUuid(KIND.COMPANY, i);
    const nn = String(i + 1).padStart(2, '0');
    const data = {
      cnpj: seedCnpj(i),
      type: companyTypes[i % companyTypes.length],
      razaoSocial: `Empresa Guadalupe ${nn} LTDA`,
      nomeFantasia: `Guadalupe ${nn}`,
      setor: setores[i % setores.length]!,
      descricao: `Empresa de teste ${nn} para validação da plataforma.`,
      endereco: 'Florianópolis/SC',
      isVerified,
      verifiedAt: isVerified ? dateOffset(-10) : null,
      verifiedByPersonId: isVerified ? coordinators[0]!.id : null,
      createdBy: responsible.id,
    };
    await prisma.company.upsert({ where: { id: companyId }, update: data, create: { id: companyId, ...data } });

    const grantId = seedUuid(KIND.COMPANY_GRANT, i);
    await prisma.personCompanyGrant.upsert({
      where: { id: grantId },
      update: { status: 'ACTIVE', revokedAt: null },
      create: {
        id: grantId,
        personId: responsible.id,
        companyId,
        grantType: 'RESPONSIBLE',
        grantedBy: responsible.id,
        status: 'ACTIVE',
        acceptedAt: dateOffset(-10),
      },
    });
    companies.push({ id: companyId, isVerified, responsibleId: responsible.id });
  }
  const verifiedCompanies = companies.filter((c) => c.isVerified);

  // 3. Vagas (autor = responsável da empresa). ACTIVE só em empresa verificada (visibilidade pública).
  const activeJobIds: string[] = [];
  for (let i = 0; i < N_JOBS; i++) {
    const status = jobStatusFor(i);
    const company =
      status === 'ACTIVE'
        ? verifiedCompanies[i % verifiedCompanies.length]!
        : companies[i % companies.length]!;
    const [title, areaName] = JOB_TEMPLATES[i % JOB_TEMPLATES.length]!;
    const jobId = seedUuid(KIND.JOB, i);
    const salaryMin = 1500 + (i % 8) * 250;
    const data = {
      companyId: company.id,
      authorPersonId: company.responsibleId,
      title: `${title} (#${String(i + 1).padStart(2, '0')})`,
      areaId: areaByName.get(areaName) ?? null,
      regionId: regionAt(i),
      description: `Vaga de ${title} para validação da plataforma. Atividades típicas da função.`,
      requirements: 'Ensino médio (desejável). Experiência na função é um diferencial.',
      workRegime: 'Presencial',
      contractType: (['CLT', 'PJ', 'Temporário'] as const)[i % 3],
      location: 'Florianópolis/SC',
      educationLevelRequired: 'Ensino médio completo',
      salaryMin,
      salaryMax: salaryMin + 700,
      salaryVisible: i % 5 !== 4,
      validUntil: status === 'EXPIRED' ? dateOffset(-5) : dateOffset(90),
      publishedAt: status === 'DRAFT' ? null : dateOffset(-3),
      status,
    };
    await prisma.job.upsert({ where: { id: jobId }, update: data, create: { id: jobId, ...data } });
    if (status === 'ACTIVE') activeJobIds.push(jobId);
  }

  // 4. Perfis de candidato (papel CANDIDATE). Maioria ACTIVE → popula a busca ativa.
  for (let i = 0; i < candidates.length; i++) {
    const person = candidates[i]!;
    const [title, areaName] = JOB_TEMPLATES[i % JOB_TEMPLATES.length]!;
    await prisma.candidateProfile.upsert({
      where: { personId: person.id },
      update: {},
      create: {
        personId: person.id,
        headline: `${title} com experiência`,
        skillsText: 'Atendimento ao público, trabalho em equipe, proatividade',
        experienceText: 'Experiências anteriores na função e correlatas.',
        educationLevel: (['ENSINO_FUNDAMENTAL', 'ENSINO_MEDIO', 'ENSINO_SUPERIOR'] as const)[i % 3],
        availability: (['Período integral', 'Meio período', 'Turnos'] as const)[i % 3],
        primaryAreaOfInterestId: areaByName.get(areaName) ?? null,
        regionId: regionAt(i),
        publicationStatus: profileStatusFor(i),
      },
    });
  }

  // 5. Perfis de prestador + serviços (papel PROVIDER).
  const activeServiceIds: string[] = [];
  for (let i = 0; i < providers.length; i++) {
    const person = providers[i]!;
    await prisma.providerProfile.upsert({
      where: { personId: person.id },
      update: {},
      create: {
        personId: person.id,
        headline: `${SERVICE_TEMPLATES[i % SERVICE_TEMPLATES.length]![0]} — profissional`,
        description: 'Prestador de serviços cadastrado para validação da plataforma.',
        regionId: regionAt(i),
        publicationStatus: profileStatusFor(i),
      },
    });
  }
  for (let i = 0; i < N_SERVICES; i++) {
    const provider = providers[i % providers.length]!;
    const [title, categoryName] = SERVICE_TEMPLATES[i % SERVICE_TEMPLATES.length]!;
    const status = serviceStatusFor(i);
    const serviceId = seedUuid(KIND.SERVICE, i);
    const priceMin = 50 + (i % 6) * 20;
    const data = {
      authorPersonId: provider.id,
      companyId: null,
      title: `${title} (#${String(i + 1).padStart(2, '0')})`,
      categoryId: categoryByName.get(categoryName) ?? null,
      regionId: regionAt(i),
      description: `Serviço de ${title} para validação da plataforma.`,
      priceMin,
      priceMax: priceMin + 100,
      priceUnit: (['por hora', 'por serviço', 'por diária'] as const)[i % 3],
      availabilityDescription: 'Segunda a sábado, horário comercial.',
      publishedAt: status === 'DRAFT' ? null : dateOffset(-3),
      status,
    };
    await prisma.service.upsert({ where: { id: serviceId }, update: data, create: { id: serviceId, ...data } });
    if (status === 'ACTIVE') activeServiceIds.push(serviceId);
  }

  // 6. Perfis leves de cliente (papel CLIENT).
  for (let i = 0; i < clients.length; i++) {
    const person = clients[i]!;
    await prisma.clientProfile.upsert({
      where: { personId: person.id },
      update: {},
      create: { personId: person.id },
    });
  }

  // 7. Candidaturas (candidato → vaga ACTIVE). Algumas canceladas (soft-cancel).
  let applications = 0;
  for (let i = 0; i < N_APPLICATIONS && activeJobIds.length > 0; i++) {
    const candidate = candidates[i % candidates.length]!;
    const jobId = activeJobIds[i % activeJobIds.length]!;
    const appId = seedUuid(KIND.APPLICATION, i);
    const cancelled = i % 7 === 6;
    await prisma.application.upsert({
      where: { id: appId },
      update: { cancelledAt: cancelled ? dateOffset(-1) : null },
      create: {
        id: appId,
        candidatePersonId: candidate.id,
        jobId,
        cancelledAt: cancelled ? dateOffset(-1) : null,
      },
    });
    applications++;
  }

  // 8. Manifestações de interesse (cliente → serviço ACTIVE). Algumas canceladas.
  let serviceInterests = 0;
  for (let i = 0; i < N_SERVICE_INTERESTS && activeServiceIds.length > 0; i++) {
    const client = clients[i % clients.length]!;
    const serviceId = activeServiceIds[i % activeServiceIds.length]!;
    const interestId = seedUuid(KIND.SERVICE_INTEREST, i);
    const cancelled = i % 8 === 7;
    await prisma.serviceInterest.upsert({
      where: { id: interestId },
      update: { cancelledAt: cancelled ? dateOffset(-1) : null },
      create: {
        id: interestId,
        clientPersonId: client.id,
        serviceId,
        cancelledAt: cancelled ? dateOffset(-1) : null,
      },
    });
    serviceInterests++;
  }

  // 9. Encaminhamentos institucionais (AS/coordenador → candidato → vaga) + Application 1:1.
  const referrers = [...socialAssistants, ...coordinators];
  let referrals = 0;
  const jobCount = activeJobIds.length;
  for (let i = 0; i < N_REFERRALS && jobCount > 0; i++) {
    const referrer = referrers[i % referrers.length]!;
    const person = candidates[i % candidates.length]!;
    // Offset p/ não colidir com a vaga da candidatura direta do mesmo candidato.
    const jobId = activeJobIds[(i + Math.floor(jobCount / 2)) % jobCount]!;
    const referralId = seedUuid(KIND.REFERRAL, i);
    const withResult = i % 4 === 0; // ~25% já acompanhados (USP-038)
    await prisma.referral.upsert({
      where: { id: referralId },
      update: {},
      create: {
        id: referralId,
        personId: person.id,
        jobId,
        referrerPersonId: referrer.id,
        justification: 'Encaminhamento institucional de teste para validação.',
        professionalSummary: 'Resumo profissional gerado para o seed de validação.',
        result: withResult ? (['HIRED', 'UNDER_REVIEW', 'NOT_SELECTED'] as const)[i % 3] : null,
        resultObservation: withResult ? 'Acompanhamento registrado no seed.' : null,
        resultRegisteredBy: withResult ? referrer.id : null,
        resultRegisteredAt: withResult ? dateOffset(-1) : null,
      },
    });
    // Application vinculada (invariante viaReferralId ⇒ viaEncaminhamento).
    const appId = seedUuid(KIND.APPLICATION_REFERRAL, i);
    await prisma.application.upsert({
      where: { id: appId },
      update: {},
      create: {
        id: appId,
        candidatePersonId: person.id,
        jobId,
        viaEncaminhamento: true,
        viaReferralId: referralId,
      },
    });
    referrals++;
  }

  // 10. Fichas socioeconômicas (candidatos; alterada por AS).
  const incomeBrackets = ['NO_INCOME', 'UP_TO_1_MW', 'FROM_1_TO_2_MW', 'FROM_2_TO_3_MW', 'UNDECLARED'] as const;
  const housing = ['OWNED', 'RENTED', 'GRANTED', 'FAMILY', 'OTHER'] as const;
  let socioeconomicRecords = 0;
  for (let i = 0; i < N_SOCIOECONOMIC && i < candidates.length; i++) {
    const person = candidates[i]!;
    const as = socialAssistants[i % socialAssistants.length]!;
    await prisma.socioeconomicRecord.upsert({
      where: { personId: person.id },
      update: {},
      create: {
        personId: person.id,
        incomeBracket: incomeBrackets[i % incomeBrackets.length],
        socialBenefit: i % 3 === 0 ? 'Bolsa Família' : null,
        housingSituation: housing[i % housing.length],
        familyComposition: `${1 + (i % 5)} pessoas na residência`,
        updatedByPersonId: as.id,
      },
    });
    socioeconomicRecords++;
  }

  // 11. Reivindicações de credencial (Pessoas pré-cadastradas SEM credencial, criadas pela AS).
  const as0 = socialAssistants[0]!;
  let credentialClaims = 0;
  for (let i = 0; i < N_CREDENTIAL_CLAIMS; i++) {
    const nn = String(i + 1).padStart(2, '0');
    const personId = seedUuid(KIND.PERSON_PRECADASTRADA, i);
    await prisma.person.upsert({
      where: { id: personId },
      update: {},
      create: {
        id: personId,
        fullName: `Pré-cadastrada ${nn} ${LAST_NAMES[i % LAST_NAMES.length]}`,
        status: 'ATIVO',
        createdByPersonId: as0.id,
      },
    });
    const claimId = seedUuid(KIND.CREDENTIAL_CLAIM, i);
    await prisma.credentialClaim.upsert({
      where: { id: claimId },
      update: {},
      create: {
        id: claimId,
        personId,
        requestedEmail: `claim${nn}@${EMAIL_DOMAIN}`,
        verificationMethod: 'AS_CONFIRMATION',
        status: 'PENDING',
      },
    });
    credentialClaims++;
  }

  // 12. Permissões delegadas (coordenador → voluntários).
  let delegatedPermissions = 0;
  const perms = ['MODERATE_JOB', 'MODERATE_SERVICE', 'MODERATE_CV'] as const;
  for (let j = 0; j < volunteers.length; j++) {
    for (let p = 0; p < 2; p++) {
      const id = seedUuid(KIND.DELEGATED_PERMISSION, j * 3 + p);
      await prisma.delegatedPermission.upsert({
        where: { id },
        update: { revokedAt: null },
        create: {
          id,
          personId: volunteers[j]!.id,
          permission: perms[p]!,
          grantedBy: coordinators[0]!.id,
        },
      });
      delegatedPermissions++;
    }
  }

  return {
    people: specs.length,
    companies: companies.length,
    jobs: N_JOBS,
    services: N_SERVICES,
    applications,
    serviceInterests,
    referrals,
    socioeconomicRecords,
    credentialClaims,
    delegatedPermissions,
  };
}
