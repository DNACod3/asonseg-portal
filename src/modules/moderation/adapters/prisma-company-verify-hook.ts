import type { Prisma } from '@prisma/client';
import { AuditEvent, type AuditTx, recordAuditEvent } from '@/modules/audit';
import { buildVerificationSnapshot } from '@/modules/companies';
import { childLogger } from '@/shared/lib/logger';
import { ContentKind } from '../domain/content-status';
import type {
  CompanyVerifyHookPort,
  ContentActivation,
} from '../ports/company-verify-hook.port';

/**
 * Adapter real do {@link CompanyVerifyHookPort} (USP-017) — substitui o
 * `StubCompanyVerifyHook` (GAP-4) no container. Roda **dentro do tx** de
 * `transitionContent`, acoplado à decisão de moderação (ADR-0024):
 *
 *  - `onContentActivated`: 1ª vaga de Empresa não verificada → marca verificada +
 *    snapshot dos dados **vigentes** (P-004) + `COMPANY_VERIFIED` no mesmo tx (E-002).
 *    Empresa já verificada → no-op idempotente (E-004 / AD-2).
 *  - `onContentRejected`: vaga de Empresa não verificada → `rejectionCount += 1`,
 *    mantém não verificada (E-003 / AD-5). O `CONTENT_REJECTED` (com motivo) é
 *    gravado pelo próprio `transitionContent` — aqui só atualiza o agregado.
 *
 * `is_verified` é marcado **somente** por este hook (P-005 / AD-3).
 */
export class PrismaCompanyVerifyHook implements CompanyVerifyHookPort {
  private readonly log = childLogger({ module: 'moderation', adapter: 'company-verify-prisma' });

  async onContentActivated(tx: AuditTx, activation: ContentActivation): Promise<void> {
    if (activation.contentKind !== ContentKind.JOB) return;

    const company = await this.loadCompanyForJob(tx, activation.contentId);
    // AD-2: a flag É o estado de "1ª vaga". Já verificada → no-op (E-004).
    if (!company || company.isVerified) return;

    const verifiedAt = new Date();
    const snapshot = buildVerificationSnapshot(company, verifiedAt);

    await tx.company.update({
      where: { id: company.id },
      data: {
        isVerified: true,
        verifiedAt,
        verifiedByPersonId: activation.actorPersonId,
        verificationJobId: activation.contentId,
        verifiedSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });

    // COMPANY_VERIFIED no MESMO tx que ativa a vaga (E-002 / ADR-0024). O snapshot
    // durável vive na coluna `verified_snapshot` (L-002); o audit guarda só os
    // metadados da verificação.
    await recordAuditEvent(
      tx,
      AuditEvent.COMPANY_VERIFIED,
      {
        entityType: 'company',
        entityId: company.id,
        before: { isVerified: false },
        after: {
          isVerified: true,
          verifiedAt,
          verifiedByPersonId: activation.actorPersonId,
          verificationJobId: activation.contentId,
        },
      },
      { actorPersonId: activation.actorPersonId, context: { verificationJobId: activation.contentId } },
    );

    this.log.info(
      { companyId: company.id, jobId: activation.contentId },
      'moderation:company-verify-hook:verified',
    );
  }

  async onContentRejected(tx: AuditTx, activation: ContentActivation): Promise<void> {
    if (activation.contentKind !== ContentKind.JOB) return;

    const company = await this.loadCompanyForJob(tx, activation.contentId);
    // Só conta rejeições enquanto a Empresa não foi verificada (E-003 / F3).
    if (!company || company.isVerified) return;

    await tx.company.update({
      where: { id: company.id },
      data: { rejectionCount: { increment: 1 } },
    });

    this.log.info(
      { companyId: company.id, jobId: activation.contentId },
      'moderation:company-verify-hook:rejection-counted',
    );
  }

  /** Empresa dona da vaga, lida **dentro do tx** (P-004 — dados vigentes). */
  private async loadCompanyForJob(tx: AuditTx, jobId: string) {
    const job = await tx.job.findUnique({
      where: { id: jobId },
      select: {
        company: {
          select: {
            id: true,
            isVerified: true,
            cnpj: true,
            razaoSocial: true,
            nomeFantasia: true,
            setor: true,
            endereco: true,
          },
        },
      },
    });
    return job?.company ?? null;
  }
}
