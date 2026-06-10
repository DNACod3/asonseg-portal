/**
 * Máquina de estados de moderação de conteúdo — núcleo declarativo (ADR-0011).
 *
 * Esta é a **fonte da verdade** das transições permitidas de vaga (JOB), CV e
 * serviço (SERVICE). Tudo aqui é **puro**: sem IO, sem `throw`, testável
 * isoladamente. A função canônica `transitionContent` (#122) consome esta tabela;
 * nenhuma camada altera a coluna `status` sem passar por ela (AC6 / P-006).
 *
 * Os valores de `ContentStatus` espelham o enum Prisma `content_status` (a USP-016
 * é a **owner** — GAP-2): mesmas strings, para que o domínio puro e a coluna do
 * banco sejam intercambiáveis sem conversão.
 */

/** Estado de moderação de um conteúdo. `EXPIRED` só se aplica a vaga (JOB). */
export enum ContentStatus {
  DRAFT = 'DRAFT',
  IN_MODERATION = 'IN_MODERATION',
  AWAITING_ADJUSTMENTS = 'AWAITING_ADJUSTMENTS',
  ACTIVE = 'ACTIVE',
  REJECTED = 'REJECTED',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED',
  ARCHIVED = 'ARCHIVED',
  INACTIVATED = 'INACTIVATED',
}

/** Tipo de conteúdo moderável. Cada tipo tem sua própria tabela de transições. */
export enum ContentKind {
  JOB = 'JOB',
  CV = 'CV',
  SERVICE = 'SERVICE',
}

/** Quem dispara a transição — determina a permissão exigida (#122). */
export type TransitionTrigger =
  | 'AUTHOR_ACTION'
  | 'MODERATOR_ACTION'
  | 'SYSTEM_JOB'
  | 'COORDINATOR_INACTIVATION';

/** Uma transição permitida da máquina de estados. */
export interface TransitionRule {
  from: ContentStatus;
  to: ContentStatus;
  trigger: TransitionTrigger;
  /** `true` quando a transição exige motivo textual do operador (devolver/rejeitar/inativar). */
  requiresJustification: boolean;
}

const S = ContentStatus;

/**
 * Transições comuns a JOB, CV e SERVICE (90% do fluxo — ADR-0011).
 * A única variação é `ACTIVE → EXPIRED` (`SYSTEM_JOB`), exclusiva de JOB.
 */
const SHARED_TRANSITIONS: readonly TransitionRule[] = [
  // Envio para moderação
  { from: S.DRAFT, to: S.IN_MODERATION, trigger: 'AUTHOR_ACTION', requiresJustification: false },
  // Decisões do moderador
  { from: S.IN_MODERATION, to: S.ACTIVE, trigger: 'MODERATOR_ACTION', requiresJustification: false },
  { from: S.IN_MODERATION, to: S.AWAITING_ADJUSTMENTS, trigger: 'MODERATOR_ACTION', requiresJustification: true },
  { from: S.IN_MODERATION, to: S.REJECTED, trigger: 'MODERATOR_ACTION', requiresJustification: true },
  // Reenvio do autor após ajustes
  { from: S.AWAITING_ADJUSTMENTS, to: S.IN_MODERATION, trigger: 'AUTHOR_ACTION', requiresJustification: false },
  // Ciclo de vida pós-publicação (autor)
  { from: S.ACTIVE, to: S.PAUSED, trigger: 'AUTHOR_ACTION', requiresJustification: false },
  { from: S.PAUSED, to: S.ACTIVE, trigger: 'AUTHOR_ACTION', requiresJustification: false },
  { from: S.ACTIVE, to: S.DRAFT, trigger: 'AUTHOR_ACTION', requiresJustification: false }, // editar
  { from: S.ACTIVE, to: S.ARCHIVED, trigger: 'AUTHOR_ACTION', requiresJustification: false },
  // Inativação administrativa (USP-018) — escape valve do coordenador
  { from: S.ACTIVE, to: S.INACTIVATED, trigger: 'COORDINATOR_INACTIVATION', requiresJustification: true },
] as const;

/** Tabela declarativa de transições permitidas por tipo de conteúdo (ADR-0011). */
export const TRANSITIONS: Readonly<Record<ContentKind, readonly TransitionRule[]>> = {
  // JOB acrescenta a expiração automática por job de sistema.
  [ContentKind.JOB]: [
    ...SHARED_TRANSITIONS,
    { from: S.ACTIVE, to: S.EXPIRED, trigger: 'SYSTEM_JOB', requiresJustification: false },
  ],
  [ContentKind.CV]: SHARED_TRANSITIONS,
  [ContentKind.SERVICE]: SHARED_TRANSITIONS,
};
