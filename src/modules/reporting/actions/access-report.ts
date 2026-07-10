'use server';

import { headers } from 'next/headers';
import { AuditEvent, withAudit } from '@/modules/audit';
import { getCurrentPerson } from '@/modules/identity';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { accessReportSchema, type AccessReportInput } from '../schemas/access-report';
import { viewPersonForAccessReport, type AccessReportData } from '../views/access-report.view';
import { ACCESS_REPORT_ROLES } from '../domain/access-report-roles';

export type {
  AccessReportConsent,
  AccessReportProfile,
  AccessReportRoleGrant,
} from '../views/access-report.view';

/** Relatório de acesso consolidado (perfil + papéis + consentimentos). */
export interface AccessReportResult extends AccessReportData {
  issuedAt: Date;
  issuedByPersonId: string;
}

/**
 * Emite o relatório de acesso de um titular (LGPD art. 19 — direito de acesso),
 * consolidando dados pessoais + histórico completo de consentimento.
 *
 * Restrito a papéis internos autorizados ({@link ACCESS_REPORT_ROLES}). A
 * emissão é registrada em `withAudit('ACCESS_REPORT_ISSUED', ...)`. Nunca lança —
 * sempre retorna `ActionResult` (project-guideline §9).
 *
 * Sequência:
 *  1. Valida o `personId` com Zod.
 *  2. AuthN (`getCurrentPerson`) + AuthZ (papel interno) do solicitante.
 *  3. Consolida o titular via View Model `viewPersonForAccessReport` (ADR-0010 —
 *     a leitura cross-Pessoa nunca é Prisma direto na action).
 *  4. Registra a emissão na auditoria.
 */
export async function issueAccessReport(
  rawInput: AccessReportInput,
): Promise<ActionResult<AccessReportResult>> {
  const log = childLogger({ module: 'reporting', action: 'issueAccessReport' });

  // 1. Validação do identificador do titular.
  const parsed = accessReportSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const { personId } = parsed.data;

  // 2. AuthN + AuthZ: precisa de sessão e de papel interno autorizado.
  const requester = await getCurrentPerson();
  if (!requester) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }
  const authorized = requester.roles.some((role) =>
    (ACCESS_REPORT_ROLES as readonly string[]).includes(role),
  );
  if (!authorized) {
    return fail('FORBIDDEN', 'Você não tem permissão para emitir este relatório.');
  }

  // 3. Consolida via View Model (leitura cross-Pessoa encapsulada — ADR-0010).
  const data = await viewPersonForAccessReport(personId);
  if (!data) {
    return fail('NOT_FOUND', 'Pessoa não encontrada.');
  }

  // 4. Contexto da request para o audit_log.
  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  const report: AccessReportResult = {
    ...data,
    issuedAt: new Date(),
    issuedByPersonId: requester.id,
  };

  try {
    // A emissão (não a leitura) é o ato auditado. `ACCESS_REPORT_ISSUED` não
    // exige justificativa.
    const issued = await withAudit(
      AuditEvent.ACCESS_REPORT_ISSUED,
      async (_tx, audit) => {
        audit.entityType = 'person';
        audit.entityId = personId;
        audit.after = {
          reportFor: personId,
          consents: data.consents.length,
          roleGrants: data.roleGrants.length,
        };
        return report;
      },
      {
        actorPersonId: requester.id,
        ip,
        userAgent,
        context: { route: '/relatorios/acesso' },
      },
    );

    return ok({ ...issued });
  } catch (err) {
    log.error({ err, personId }, 'reporting:access-report:failed');
    return fail('INTERNAL', 'Erro interno. Tente novamente mais tarde.');
  }
}
