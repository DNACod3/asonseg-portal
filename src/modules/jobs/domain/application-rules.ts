import type { ContentStatus } from '@prisma/client';

/**
 * Regras puras (sem IO) de elegibilidade de candidatura (USP-025/026 — AD-017).
 * Espelham as pré-condições da Server Action `applyToJob`, testáveis isoladamente
 * e reaproveitando a semântica do `where` on-read de `search-jobs.ts` (CAN-025-E1)
 * sem duplicar SQL.
 */

/** Shape mínimo de uma vaga necessário para decidir se aceita candidatura. */
export interface ApplicationJobInput {
  status: ContentStatus;
  validUntil: Date | null;
  companyIsVerified: boolean;
}

/**
 * WHEN a vaga está `ACTIVE`, não expirou (`validUntil >= today`) e a Empresa está
 * verificada THEN elegível a candidatura (CAN-025-E1). Mesma semântica de
 * `buildWhere` (`search-jobs.ts`): `status='ACTIVE' AND valid_until>=hoje(SP) AND
 * company.is_verified`. `validUntil` nulo (nunca deveria ocorrer numa vaga ACTIVE
 * publicada) é tratado como não-elegível — falha segura.
 */
export function isJobOpenForApplication(job: ApplicationJobInput, today: Date): boolean {
  return job.status === 'ACTIVE' && job.validUntil != null && job.validUntil >= today && job.companyIsVerified;
}

/** Shape mínimo do perfil de candidato necessário para decidir a elegibilidade. */
export interface ApplicationProfileInput {
  publicationStatus: ContentStatus;
}

/**
 * WHEN o candidato possui `CandidateProfile` moderado (`publicationStatus ===
 * 'ACTIVE'`) THEN elegível a candidatar-se (CAN-025-04). Perfil inexistente
 * (`null` — Pessoa sem papel candidato ativado) ou em qualquer outro status
 * (`DRAFT`, `IN_MODERATION`, etc.) é não-elegível.
 */
export function isProfileApplicable(profile: ApplicationProfileInput | null): boolean {
  return profile != null && profile.publicationStatus === 'ACTIVE';
}

/** Resultado discriminado da elegibilidade de cancelamento (USP-026). */
export type CancelApplicationCheck = { ok: true } | { ok: false; reason: 'ALREADY_CANCELLED' };

/**
 * WHEN a candidatura já está cancelada (`cancelledAt != null`) THEN SHALL NOT
 * permitir novo cancelamento (CAN-026-E1/MN-02). A checagem de dono/existência é
 * responsabilidade da query escopada em `cancelApplication` — esta regra pura só
 * decide sobre o estado de uma linha já pertencente ao candidato.
 */
export function canCancelApplication(app: { cancelledAt: Date | null }): CancelApplicationCheck {
  return app.cancelledAt == null ? { ok: true } : { ok: false, reason: 'ALREADY_CANCELLED' };
}
