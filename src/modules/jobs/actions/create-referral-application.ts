import type { Prisma } from '@prisma/client';
import { ApplyConflictError } from '../domain/apply-errors';

export interface CreateReferralApplicationArgs {
  jobId: string;
  candidatePersonId: string;
  referralId: string;
}

export interface CreateReferralApplicationResult {
  applicationId: string;
}

/**
 * Helper transacional (tx-participant) que cria a `Application` vinculada a um
 * `Referral` (USP-037 / AD-017 — Application é owned por `jobs`, `referrals`
 * importa este helper via barrel). Deve ser chamado DENTRO da transação do
 * chamador (`createReferral` / `withAudit`), nunca abre transação própria.
 *
 * Diferente de `applyToJob`, **não** verifica sessão/consent/`CandidateProfile`
 * ACTIVE — essas pré-condições não se aplicam ao encaminhamento institucional
 * (a Pessoa pode nem ter papel candidato ativo antes do encaminhamento; quem
 * decide é `createReferral`, chamando `ensureCandidateRole` antes deste helper).
 *
 * A garantia real de unicidade da candidatura ATIVA por (candidato, vaga) é o
 * mesmo índice único parcial `uq_application_active` (USP-025 T1) que protege
 * `applyToJob` — sob corrida, o `INSERT` aqui dispara `P2002`, mapeado para
 * {@link ApplyConflictError} (REF-MN-01), que o chamador converte em `CONFLICT`
 * e faz o rollback atômico do encaminhamento inteiro (sem `Referral` órfão).
 */
export async function createReferralApplication(
  tx: Prisma.TransactionClient,
  { jobId, candidatePersonId, referralId }: CreateReferralApplicationArgs,
): Promise<CreateReferralApplicationResult> {
  try {
    const created = await tx.application.create({
      data: { jobId, candidatePersonId, viaReferralId: referralId, viaEncaminhamento: true },
      select: { id: true },
    });
    return { applicationId: created.id };
  } catch (err) {
    if (err instanceof Error && (err as { code?: string }).code === 'P2002') {
      throw new ApplyConflictError();
    }
    throw err;
  }
}
