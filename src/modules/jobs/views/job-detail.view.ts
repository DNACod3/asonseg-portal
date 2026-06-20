import { Prisma } from '@prisma/client';
import type { CurrentPerson } from '@/modules/identity';
import { decimalToNumber, companyDisplayName } from './company-display';

/**
 * View Model do **detalhe da vaga** (USP-022 / ADR-0017 / ADR-0022).
 *
 * É a **única fonte de anonimização** do detalhe (runbook-view-model-visibility):
 * consumido tanto pela página quanto pelo `generateMetadata`/JSON-LD (P-002 — anonimizar
 * uma vez, no serializer, nunca no template). Para o **visitante anônimo** o nome real da
 * Empresa é dado restrito (ADR-0017) e NUNCA sai — em nenhum campo, HTML, JSON, OG ou
 * JSON-LD (E-001/P-002). Para o autenticado, o nome real aparece (E-002).
 *
 * Estende `viewJobForVisitor` (lista) com os campos de texto longo do detalhe, o contador
 * de candidaturas com limiar (E-003/P-001) e as flags de CTA por papel (E-002/E-004/P-003).
 */

/**
 * Papel que habilita o botão "candidatar-se" (E-002). É o valor do enum `Role`
 * (`prisma/schema.prisma`), não o rótulo em PT — a sessão expõe `roles: string[]`.
 */
export const CANDIDATE_ROLE = 'CANDIDATE';

/**
 * Limiar do contador de candidaturas (E-003/P-001). Abaixo dele o contador NÃO é
 * exibido — evita o efeito psicológico inverso quando N é baixo. Tunável.
 */
export const APPLICATION_COUNTER_THRESHOLD = 3;

/** Faixa salarial projetada (null quando `salaryVisible=false` — edge do issue). */
export interface JobDetailSalary {
  min: number | null;
  max: number | null;
}

export interface JobDetail {
  id: string;
  title: string;
  description: string | null;
  requirements: string | null;
  benefits: string | null;
  workRegime: string | null;
  location: string | null;
  contractType: string | null;
  educationLevel: string | null;
  area: string | null;
  region: string | null;
  validUntil: Date | null;
  publishedAt: Date | null;
  salary: JobDetailSalary | null;
  company: {
    /** Anônimo → "Empresa do setor de X"; autenticado → nome fantasia real. */
    displayName: string;
    isAnonymized: boolean;
  };
  /** Contagem de candidaturas ativas, ou `null` quando abaixo do limiar (E-003/P-001). */
  applicationCount: number | null;
  /** Papel candidato ativo → mostra o botão "candidatar-se" (E-002). */
  canApply: boolean;
  /** Autenticado sem papel candidato → CTA "Ativar perfil candidato" (E-004/P-003). */
  showActivateCandidateCta: boolean;
}

/** Shape mínimo que o serializer consome (a query faz `select` explícito disto). */
export interface JobDetailRow {
  id: string;
  title: string;
  description: string | null;
  requirements: string | null;
  benefits: string | null;
  workRegime: string | null;
  location: string | null;
  contractType: string | null;
  educationLevelRequired: string | null;
  salaryMin: Prisma.Decimal | null;
  salaryMax: Prisma.Decimal | null;
  salaryVisible: boolean;
  validUntil: Date | null;
  publishedAt: Date | null;
  area: { name: string } | null;
  region: { name: string } | null;
  // `nomeFantasia` é opcional: a query NÃO o carrega para o anônimo (least privilege,
  // P-002). `setor` é sempre presente (base da anonimização).
  company: { setor: string; nomeFantasia?: string | null };
  /** Candidaturas ativas (cancelledAt = null) contadas na query — sem N+1. */
  applicationCount: number;
}

/**
 * Projeta uma linha de detalhe de vaga para o View Model, aplicando privacidade por papel.
 *
 * - `viewer === null` (anônimo): `displayName = "Empresa do setor de " + setor`,
 *   `isAnonymized = true`; nome real **nunca** sai (E-001/P-002). `canApply` e
 *   `showActivateCandidateCta` ambos `false` (a UI mostra CTA de criar conta).
 * - `viewer` com papel candidato: nome real + `canApply = true` (E-002).
 * - `viewer` autenticado sem papel candidato: nome real + `showActivateCandidateCta = true`
 *   (E-004/P-003).
 * - Contador: `count >= APPLICATION_COUNTER_THRESHOLD ? count : null` (E-003/P-001).
 * - `salaryVisible === false` ⇒ `salary = null` (edge, independe do papel).
 */
export function viewJobDetail(row: JobDetailRow, viewer: CurrentPerson | null): JobDetail {
  const isAnonymized = viewer === null;
  const canApply = viewer != null && viewer.roles.includes(CANDIDATE_ROLE);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    requirements: row.requirements,
    benefits: row.benefits,
    workRegime: row.workRegime,
    location: row.location,
    contractType: row.contractType,
    educationLevel: row.educationLevelRequired,
    area: row.area?.name ?? null,
    region: row.region?.name ?? null,
    validUntil: row.validUntil,
    publishedAt: row.publishedAt,
    salary: row.salaryVisible
      ? { min: decimalToNumber(row.salaryMin), max: decimalToNumber(row.salaryMax) }
      : null,
    company: {
      // Anonimização por papel na fonte única (E-001/E-002/P-002) — ver `company-display`.
      displayName: companyDisplayName(row.company, isAnonymized),
      isAnonymized,
    },
    applicationCount:
      row.applicationCount >= APPLICATION_COUNTER_THRESHOLD ? row.applicationCount : null,
    canApply,
    showActivateCandidateCta: viewer != null && !canApply,
  };
}

/**
 * JSON-LD schema.org `JobPosting` do detalhe (USP-022 / T4 / P-002). Para SEO/social o
 * conteúdo é **sempre anônimo**: passe SEMPRE uma projeção anonimizada
 * (`viewJobDetail(row, null)`) — `hiringOrganization.name` usa o rótulo por setor, nunca o
 * nome real da Empresa (P-002, em todos os canais). Chaves `undefined` são descartadas pelo
 * `JSON.stringify`, mantendo o objeto enxuto.
 */
export function jobDetailJsonLd(job: JobDetail): Record<string, unknown> {
  const salary =
    job.salary && (job.salary.min != null || job.salary.max != null)
      ? {
          '@type': 'MonetaryAmount',
          currency: 'BRL',
          value: {
            '@type': 'QuantitativeValue',
            minValue: job.salary.min ?? undefined,
            maxValue: job.salary.max ?? undefined,
            unitText: 'MONTH',
          },
        }
      : undefined;

  return {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description ?? undefined,
    datePosted: job.publishedAt?.toISOString(),
    validThrough: job.validUntil?.toISOString(),
    employmentType: job.contractType ?? undefined,
    // Organização anonimizada por setor (P-002) — nunca o nome real.
    hiringOrganization: { '@type': 'Organization', name: job.company.displayName },
    jobLocation: job.location
      ? {
          '@type': 'Place',
          address: { '@type': 'PostalAddress', addressLocality: job.location },
        }
      : undefined,
    baseSalary: salary,
  };
}

/**
 * Serializa um objeto JSON-LD para injeção **segura** dentro de um `<script>` (USP-022 / T4).
 *
 * `JSON.stringify` por si só não escapa `<`, `>` ou `&`, então um campo controlado pela
 * Empresa (título/descrição/local) contendo `</script>` quebraria o bloco e abriria XSS
 * armazenado. Aqui esses caracteres — mais os separadores de linha U+2028/U+2029, que são
 * quebras de linha válidas em JS mas não em JSON — viram escapes unicode. O resultado segue
 * sendo JSON válido (o parser do crawler o lê igual), mas inerte como HTML.
 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
