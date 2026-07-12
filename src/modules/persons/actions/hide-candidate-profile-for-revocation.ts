import type { Prisma } from '@prisma/client';

export interface HideCandidateProfileForRevocationContext {
  personId: string;
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
 * (OCULTAR). Escrita direta (não via `transitionContent` — A-4: FSM abre a
 * própria `withAudit`, não aninhável na tx da revogação, e `PAUSED` via FSM é
 * inalcançável para `CANDIDATE_PROFILE`); precedente idêntico em
 * `activate-candidate-role.ts`.
 *
 * Recebe o `tx` da transação em curso — **não** abre transação própria.
 * Perfil ausente ou já não-`ACTIVE` (DRAFT/IN_MODERATION/PAUSED/…) é no-op
 * (`hidden:false`, USP053-E2): já não é listável, nada a fazer. Escopo
 * estritamente por `personId` (USP053-MN-05) — nenhum outro titular é tocado.
 * Só `publicationStatus`/`lastStatusChangeAt` mudam; demais campos e a linha
 * do perfil são preservados (USP053-MN-03).
 */
export async function hideCandidateProfileForRevocation(
  tx: Prisma.TransactionClient,
  ctx: HideCandidateProfileForRevocationContext,
): Promise<HideCandidateProfileForRevocationResult> {
  const result = await tx.candidateProfile.updateMany({
    where: { personId: ctx.personId, publicationStatus: 'ACTIVE' },
    data: { publicationStatus: 'PAUSED', lastStatusChangeAt: new Date() },
  });
  return { hidden: result.count > 0 };
}
