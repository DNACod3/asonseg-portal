import type { Prisma } from '@prisma/client';
import { ContentKind, ContentStatus, transitionContent } from '@/modules/moderation';

export interface HideCandidateProfileForRevocationContext {
  personId: string;
  /** Ator no plano de domínio (Pessoa) — registrado na auditoria da transição (AC5). */
  actorPersonId: string;
  ip: string | null;
  userAgent: string | null;
  justification: string;
}

export interface HideCandidateProfileForRevocationResult {
  /** `true` se o perfil estava `ACTIVE` e foi rebaixado a `PAUSED` (OCULTAR aplicado). */
  hidden: boolean;
}

/**
 * Participante de transação (USP-053 / CAND-7 — OCULTAR) que rebaixa o
 * `CandidateProfile.publicationStatus` de `ACTIVE` para `PAUSED` do titular,
 * dentro da mesma tx da revogação de `JOB_APPLICATION` (A-2/A-3/A-4).
 *
 * `PAUSED` é um valor **já existente** do enum `ContentStatus` — a busca ativa
 * (`search-candidates.ts`) já filtra só `publication_status='ACTIVE'`, então o
 * perfil some de todas as visões dali para frente **sem** tocar a query
 * (OCULTAR).
 *
 * Via `transitionContent()` (ADR-0011 — única via de mudança de status; `/pr-review`
 * remediação Fase 8): a transição `{ from: ACTIVE, to: PAUSED, trigger: AUTHOR_ACTION }`
 * **é** modelada em `SHARED_TRANSITIONS` para qualquer `ContentKind`, incluindo
 * `CANDIDATE_PROFILE` — a suposição anterior de que seria "inalcançável" estava
 * incorreta. O obstáculo real (FSM abrir sua própria `withAudit`, não aninhável na
 * tx da revogação) foi removido estendendo `transitionContent` para aceitar um `tx`
 * externo (mesmo padrão de threading já usado por
 * `ModerationNotificationPort.sendModerationDecision(tx, …)`, USP-057) — assim a
 * transição participa da tx do chamador **e** grava seu próprio evento de auditoria
 * (`CANDIDATE_PROFILE_PAUSED`, `entityType=CANDIDATE_PROFILE`/`entityId=personId`),
 * fechando a lacuna forense apontada pelo reviewer de segurança (antes só um
 * `profileHidden: true` solto dentro do audit event `CONSENT_REVOKED`).
 *
 * Recebe o `tx` da transação em curso — **não** abre transação própria.
 * Perfil ausente (`NOT_FOUND`) ou já não-`ACTIVE` (`INVALID_TRANSITION` —
 * DRAFT/IN_MODERATION/PAUSED/…) é no-op (`hidden:false`, USP053-E2): já não é
 * listável, nada a fazer. Qualquer outra falha (`INTERNAL`) é inesperada e é
 * relançada para acionar o rollback da tx externa (USP053-04/MN-04 —
 * `transitionContent` nunca lança, então a falha vira exceção aqui). Escopo
 * estritamente por `personId` (USP053-MN-05) — nenhum outro titular é tocado.
 * Só `publicationStatus`/`lastStatusChangeAt` mudam; demais campos e a linha
 * do perfil são preservados (USP053-MN-03).
 */
export async function hideCandidateProfileForRevocation(
  tx: Prisma.TransactionClient,
  ctx: HideCandidateProfileForRevocationContext,
): Promise<HideCandidateProfileForRevocationResult> {
  const result = await transitionContent({
    tx,
    contentKind: ContentKind.CANDIDATE_PROFILE,
    contentId: ctx.personId,
    to: ContentStatus.PAUSED,
    trigger: 'AUTHOR_ACTION',
    actorPersonId: ctx.actorPersonId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    justification: ctx.justification,
  });

  if (result.ok) return { hidden: true };
  if (result.error.code === 'NOT_FOUND' || result.error.code === 'INVALID_TRANSITION') {
    return { hidden: false };
  }
  throw new Error(
    `hideCandidateProfileForRevocation: falha inesperada da FSM (${result.error.code}) — ${result.error.message}`,
  );
}
