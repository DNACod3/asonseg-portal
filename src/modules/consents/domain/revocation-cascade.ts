import type { Role } from '@prisma/client';
import type { ConsentPurpose } from './purposes';
import { PURPOSE_ROLE_MAP } from './purpose-role-map';

/**
 * Matriz declarativa **finalidade → efeitos** da cascata de revogação (ADR-0025).
 *
 * O ADR-0025 fixou o **mecanismo** (matriz declarativa + `requireActiveConsent`
 * on-read + registro append-only) e deixou a **semântica concreta** — o destino
 * dos artefatos/dados já ativos ou compartilhados — para a DPO + jurídico
 * definirem. Esta é a materialização dessa semântica, **aprovada em 2026-06-03**
 * (DPO diretora Angélica + jurídico), a partir do draft
 * `docs/lgpd/cascata-revogacao-semantica.md` (adendo ao ADR-0025).
 *
 * **Escopo deste arquivo:** é a *fonte declarativa da verdade* dos efeitos. A
 * **aplicação** de cada efeito em seu módulo (encerrar candidaturas em `jobs`,
 * despublicar serviços em `services`, etc.) é trabalho das USPs desses módulos
 * (USP-025/030/033 e afins) que **consomem** esta matriz. A garantia de "zero
 * janela de papel ativo sem consentimento" (P-002) já é dada on-read pelo
 * `requireActiveConsent` no ponto de uso, independentemente do efeito assíncrono.
 *
 * O papel desativado em cascata é derivado de {@link PURPOSE_ROLE_MAP} (fonte
 * única) — não há duplicação aqui.
 */

/** Vocabulário de efeitos aprovado (draft §3). */
export const CASCADE_EFFECTS = [
  /** Artefato permanece como está — tratamento lícito já realizado (não-retroativo). */
  'MANTER',
  /** Mantém o registro com flag "finalidade revogada em DD/MM" (histórico — ADR-0008). */
  'MARCAR',
  /** Some das visões dali para frente (busca, catálogo, pipeline ativo); registro preservado. */
  'OCULTAR',
  /** Retira o artefato do fluxo ativo (ex.: candidatura → "retirada"); preserva histórico. */
  'ENCERRAR',
  /** Remove/ofusca PII do artefato mantendo o dado institucional. */
  'ANONIMIZAR',
] as const;

export type CascadeEffect = (typeof CASCADE_EFFECTS)[number];

/** Efeito(s) sobre uma categoria de artefato/dado quando a finalidade é revogada. */
export interface CascadeArtifactRule {
  /** Categoria de artefato/dado afetado (chave estável, consumida pelos módulos). */
  readonly artifact: string;
  /** Efeitos aprovados para esse artefato (combináveis, ex.: ENCERRAR + MARCAR). */
  readonly effects: readonly CascadeEffect[];
  /** Justificativa LGPD / observação operacional. */
  readonly note: string;
}

/** Regra de cascata de uma finalidade. */
export interface RevocationCascadeRule {
  readonly purpose: ConsentPurpose;
  /** Papel desativado em cascata (`REVOKED`); `null` se a finalidade não ativa papel. */
  readonly role: Role | null;
  /** A revogação inativa a conta de acesso (somente `PORTAL_ACCESS`). */
  readonly accountInactivation: boolean;
  /**
   * `PORTAL_ACCESS`: os demais consentimentos ficam **suspensos** (re-aceite no
   * retorno), não revogados em cascata (decisão aprovada — draft §4.8, opção
   * "suspender").
   */
  readonly suspendOtherConsents: boolean;
  /** Notifica a equipe interna (assistência social) — finalidades sociais. */
  readonly notifyInternalTeam: boolean;
  /** Efeitos sobre artefatos/dados já ativos ou compartilhados. */
  readonly artifactEffects: readonly CascadeArtifactRule[];
  /** Política específica da finalidade (edge cases decididos pela DPO). */
  readonly policyNote?: string;
}

/**
 * Regras transversais aprovadas (draft §5) — valem para todas as finalidades.
 */
export const CASCADE_CROSS_CUTTING = {
  /** Efeito imediato — sem carência (P-002: zero janela de papel ativo sem consentimento). */
  graceWindowDays: 0,
  /** Re-concessão exige novo aceite (novo `acceptedAt`/hash); sem ressurreição automática. */
  reGrantRequiresNewConsent: true,
  /** Regra geral: terceiros indivíduos **não** são notificados (o artefato só sai do fluxo ativo). */
  notifyThirdParties: false,
} as const;

/**
 * Fonte da verdade dos efeitos da revogação por finalidade.
 * `role` é derivado de {@link PURPOSE_ROLE_MAP} para impedir divergência.
 */
export const REVOCATION_CASCADE_MATRIX: Record<ConsentPurpose, RevocationCascadeRule> = {
  PORTAL_ACCESS: {
    purpose: 'PORTAL_ACCESS',
    role: PURPOSE_ROLE_MAP.PORTAL_ACCESS,
    accountInactivation: true,
    suspendOtherConsents: true,
    notifyInternalTeam: false,
    artifactEffects: [
      {
        artifact: 'conta-de-acesso',
        effects: ['ENCERRAR'],
        note: 'Sustenta o acesso: revogar inativa a conta; sem login as demais finalidades ficam inalcançáveis.',
      },
      {
        artifact: 'historico-institucional',
        effects: ['MANTER'],
        note: 'Atendimentos, candidaturas e auditoria preservados — não exclusão (ADR-0008); audit append-only (ADR-0023).',
      },
    ],
    policyNote:
      'Demais consentimentos ficam SUSPENSOS (re-aceite no retorno), não revogados em cascata.',
  },
  JOB_APPLICATION: {
    purpose: 'JOB_APPLICATION',
    role: PURPOSE_ROLE_MAP.JOB_APPLICATION,
    accountInactivation: false,
    suspendOtherConsents: false,
    notifyInternalTeam: false,
    artifactEffects: [
      {
        artifact: 'candidaturas-ativas',
        effects: ['ENCERRAR', 'MARCAR'],
        note: 'Marcadas como "retiradas por revogação"; saem do pipeline ativo do empregador.',
      },
      {
        artifact: 'perfil-candidato-visivel-empregadores',
        effects: ['OCULTAR'],
        note: 'Sai de buscas/listagens dali para frente (View Models — ADR-0010).',
      },
      {
        artifact: 'dados-ja-vistos-empregador',
        effects: ['MANTER'],
        note: 'Tratamento lícito já realizado — não-retroativo (LGPD art. 8º, §5º).',
      },
    ],
  },
  SERVICE_OFFERING: {
    purpose: 'SERVICE_OFFERING',
    role: PURPOSE_ROLE_MAP.SERVICE_OFFERING,
    accountInactivation: false,
    suspendOtherConsents: false,
    notifyInternalTeam: false,
    artifactEffects: [
      {
        artifact: 'servicos-publicados-catalogo',
        effects: ['OCULTAR'],
        note: 'Despublicar do catálogo público (transição via máquina de estados — ADR-0011, sem update direto).',
      },
      {
        artifact: 'contratacoes-em-andamento',
        effects: ['MARCAR'],
        note: 'O prestador deixa de ser contatável por novos clientes; vínculos in-flight ver SERVICE_HIRING.',
      },
    ],
  },
  SERVICE_HIRING: {
    purpose: 'SERVICE_HIRING',
    role: PURPOSE_ROLE_MAP.SERVICE_HIRING,
    accountInactivation: false,
    suspendOtherConsents: false,
    notifyInternalTeam: false,
    artifactEffects: [
      {
        artifact: 'manifestacoes-ativas',
        effects: ['ENCERRAR', 'MARCAR'],
        note: 'Retiradas; o contato deixa de ser compartilhado com novos prestadores.',
      },
      {
        artifact: 'contato-ja-revelado-prestador',
        effects: ['MANTER'],
        note: 'Já compartilhado licitamente — não-retroativo (art. 8º, §5º).',
      },
    ],
  },
  COMPANY_REPRESENTATION: {
    purpose: 'COMPANY_REPRESENTATION',
    role: PURPOSE_ROLE_MAP.COMPANY_REPRESENTATION,
    accountInactivation: false,
    suspendOtherConsents: false,
    notifyInternalTeam: false,
    artifactEffects: [
      {
        artifact: 'vagas-da-empresa',
        effects: ['MANTER'],
        note: 'Pertencem à empresa (entidade sem login — ADR-0015), não à pessoa; só a representação da pessoa cessa.',
      },
      {
        artifact: 'representacao-da-pessoa',
        effects: ['ENCERRAR'],
        note: 'Pessoa removida como responsável (COMPANY_RESPONSIBLE_REMOVED).',
      },
    ],
    policyNote:
      'Edge "empresa órfã" (pessoa = único responsável): permitir a revogação e ALERTAR a coordenação para nova designação (decisão aprovada — draft §4.4, opção b).',
  },
  SOCIAL_ASSISTANCE: {
    purpose: 'SOCIAL_ASSISTANCE',
    role: PURPOSE_ROLE_MAP.SOCIAL_ASSISTANCE,
    accountInactivation: false,
    suspendOtherConsents: false,
    notifyInternalTeam: true,
    artifactEffects: [
      {
        artifact: 'historico-atendimento-social',
        effects: ['MANTER', 'MARCAR'],
        note: 'Dado sensível (art. 11): preservar por dever de guarda legal e restringir o acesso ao necessário.',
      },
    ],
    policyNote:
      'Uso futuro do dado sensível bloqueado on-read; acesso ao histórico restrito. Prazo de guarda legal a confirmar com o jurídico (não bloqueia a cascata).',
  },
  CV_AI_EXTRACTION: {
    purpose: 'CV_AI_EXTRACTION',
    role: PURPOSE_ROLE_MAP.CV_AI_EXTRACTION,
    accountInactivation: false,
    suspendOtherConsents: false,
    notifyInternalTeam: false,
    artifactEffects: [
      {
        artifact: 'dados-ja-extraidos-do-cv',
        effects: ['MANTER'],
        note: 'Processados licitamente; provedor opera em ZDR — sem cópia a expurgar no terceiro (ADR-0027).',
      },
    ],
    policyNote:
      'Novos envios ao provedor de IA bloqueados on-read; re-extração exige novo consentimento (+ nova versão de termo se trocar o provedor — ADR-0009/0012).',
  },
  SOCIAL_REFERRAL_TO_JOB: {
    purpose: 'SOCIAL_REFERRAL_TO_JOB',
    role: PURPOSE_ROLE_MAP.SOCIAL_REFERRAL_TO_JOB,
    accountInactivation: false,
    suspendOtherConsents: false,
    notifyInternalTeam: true,
    artifactEffects: [
      {
        artifact: 'encaminhamentos-ja-realizados',
        effects: ['MANTER', 'MARCAR'],
        note: 'Perfil já compartilhado com empregador/vaga — não-retroativo (art. 8º, §5º).',
      },
    ],
    policyNote: 'Novos encaminhamentos institucionais bloqueados on-read.',
  },
};

/** Regra de cascata de revogação da finalidade. */
export function revocationCascadeFor(purpose: ConsentPurpose): RevocationCascadeRule {
  return REVOCATION_CASCADE_MATRIX[purpose];
}
