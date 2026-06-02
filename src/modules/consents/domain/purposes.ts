import type { ConsentPurpose as PrismaConsentPurpose } from '@prisma/client';

/**
 * Finalidades de consentimento LGPD do MVP (ADR-0009 / ADR-0013).
 *
 * Conjunto **fechado** de 8 finalidades — adicionar uma nova exige decisão
 * formal de produto + revisão jurídica (P-008 das expectations da USP-043).
 * A ordem espelha a numeração 1–8 do termo de cada finalidade.
 */
export const CONSENT_PURPOSES = [
  'PORTAL_ACCESS',
  'JOB_APPLICATION',
  'SERVICE_OFFERING',
  'SERVICE_HIRING',
  'COMPANY_REPRESENTATION',
  'SOCIAL_ASSISTANCE',
  'CV_AI_EXTRACTION',
  'SOCIAL_REFERRAL_TO_JOB',
] as const satisfies readonly PrismaConsentPurpose[];

/** Finalidade de consentimento — reexporta o enum do Prisma para uso via barrel. */
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

/** `true` se a string é uma das 8 finalidades fechadas do MVP. */
export function isConsentPurpose(value: string): value is ConsentPurpose {
  return (CONSENT_PURPOSES as readonly string[]).includes(value);
}

/**
 * Metadados humanos de uma finalidade — alimentam o painel do titular
 * (E-003 / P-005: nome humano + descrição + base legal, nunca só o código).
 */
export interface PurposeMetadata {
  readonly purpose: ConsentPurpose;
  /** Diretório do termo em `legal/consent-terms/<slug>/`. */
  readonly slug: string;
  /** Nome humano em PT-BR exibido ao titular. */
  readonly humanName: string;
  /** Descrição curta do que a finalidade autoriza. */
  readonly description: string;
  /** Base legal LGPD (transparência — P-005). */
  readonly legalBasis: string;
}

/** Catálogo de metadados humanos por finalidade (P-005 — transparência máxima). */
export const PURPOSE_METADATA: Record<ConsentPurpose, PurposeMetadata> = {
  PORTAL_ACCESS: {
    purpose: 'PORTAL_ACCESS',
    slug: 'portal-access',
    humanName: 'Acesso ao portal',
    description: 'Cadastro e autenticação na sua conta do portal ASONSEG.',
    legalBasis: 'LGPD art. 7º, V (execução de contrato) e art. 7º, I (consentimento)',
  },
  JOB_APPLICATION: {
    purpose: 'JOB_APPLICATION',
    slug: 'job-application',
    humanName: 'Candidatura a vagas',
    description: 'Candidatar-se a vagas e ter seu perfil avaliado por empregadores.',
    legalBasis: 'LGPD art. 7º, I (consentimento do titular)',
  },
  SERVICE_OFFERING: {
    purpose: 'SERVICE_OFFERING',
    slug: 'service-offering',
    humanName: 'Oferta de serviços',
    description: 'Publicar e oferecer seus serviços no catálogo do portal.',
    legalBasis: 'LGPD art. 7º, I (consentimento do titular)',
  },
  SERVICE_HIRING: {
    purpose: 'SERVICE_HIRING',
    slug: 'service-hiring',
    humanName: 'Contratação de serviços',
    description: 'Contratar prestadores e compartilhar seu contato com eles.',
    legalBasis: 'LGPD art. 7º, I (consentimento) e art. 7º, V (execução de contrato)',
  },
  COMPANY_REPRESENTATION: {
    purpose: 'COMPANY_REPRESENTATION',
    slug: 'company-representation',
    humanName: 'Representação de empresa',
    description: 'Atuar como responsável por uma empresa cadastrada no portal.',
    legalBasis: 'LGPD art. 7º, I (consentimento) e art. 7º, IX (legítimo interesse)',
  },
  SOCIAL_ASSISTANCE: {
    purpose: 'SOCIAL_ASSISTANCE',
    slug: 'social-assistance',
    humanName: 'Atendimento social',
    description: 'Atendimento social da ASONSEG, com tratamento de dados sensíveis.',
    legalBasis: 'LGPD art. 11, I (consentimento para dado sensível)',
  },
  CV_AI_EXTRACTION: {
    purpose: 'CV_AI_EXTRACTION',
    slug: 'cv-ai-extraction',
    humanName: 'Extração de currículo por IA',
    description: 'Envio do seu currículo a um provedor de IA para extração automática dos dados.',
    legalBasis: 'LGPD art. 7º, I (consentimento específico do titular)',
  },
  SOCIAL_REFERRAL_TO_JOB: {
    purpose: 'SOCIAL_REFERRAL_TO_JOB',
    slug: 'social-referral-to-job',
    humanName: 'Encaminhamento institucional',
    description: 'Encaminhamento da ASONSEG do seu perfil para vagas e oportunidades.',
    legalBasis: 'LGPD art. 7º, I (consentimento) e art. 7º, IX (legítimo interesse)',
  },
};

/** Metadados humanos de uma finalidade. */
export function purposeMetadata(purpose: ConsentPurpose): PurposeMetadata {
  return PURPOSE_METADATA[purpose];
}
