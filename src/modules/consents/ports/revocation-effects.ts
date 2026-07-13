import type { Prisma } from '@prisma/client';
import { createToken } from '@/shared/container';

/**
 * Porta dos efeitos de artefato da cascata de revogação (USP-053 / CAND-7 —
 * A-5). `consents` **define** de que precisa (Dependency Inversion); os
 * módulos donos do dado (`jobs`, `persons`) **fornecem** o adapter concreto,
 * ligado no composition-root (`shared/container.ts`) — espelha
 * `COMPANY_RESPONSIBILITY_TOKEN` (`persons/ports/companyResponsibility.ts`).
 *
 * `consents` não importa `@/modules/jobs`/`@/modules/persons` (evita ciclo de
 * barrel — `jobs→consents` e `persons→consents` já existem). Consumidores
 * resolvem a implementação por `container.resolve(REVOCATION_EFFECTS_TOKEN)` —
 * nunca importam o adapter direto.
 */

/** Cliente transacional interativo do Prisma — a mesma tx de `withAudit(CONSENT_REVOKED)`. */
export type RevocationTx = Prisma.TransactionClient;

export interface RevocationEffectsContext {
  personId: string;
  actorPersonId: string;
  ip: string | null;
  userAgent: string | null;
  justification: string;
}

export interface JobApplicationCascadeOutcome {
  applicationsEnded: number;
  endedApplicationIds: string[];
  profileHidden: boolean;
}

export interface RevocationEffectsPort {
  /**
   * Aplica, na mesma `tx` recebida, os efeitos de artefato de `JOB_APPLICATION`
   * declarados em `REVOCATION_CASCADE_MATRIX` (ENCERRAR+MARCAR candidaturas
   * ativas + OCULTAR o perfil). Não abre transação própria.
   */
  applyJobApplicationCascade(
    tx: RevocationTx,
    ctx: RevocationEffectsContext,
  ): Promise<JobApplicationCascadeOutcome>;
}

export const REVOCATION_EFFECTS_TOKEN = createToken<RevocationEffectsPort>(
  'consents.RevocationEffects',
);
