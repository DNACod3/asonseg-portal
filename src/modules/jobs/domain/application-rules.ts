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

// (a regra de cancelamento `canCancelApplication` é adicionada pela USP-026 neste
// mesmo arquivo — ver design.md da USP-025, Components §2.)
