'use server';

import { headers } from 'next/headers';
import { AuditEvent, withAudit } from '@/modules/audit';
import { purposeMetadata } from '@/modules/consents';
import { getCurrentPerson } from '@/modules/identity';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { accessReportSchema, type AccessReportInput } from '../schemas/access-report';

/**
 * Papéis internos autorizados a emitir o relatório de acesso de um titular
 * (LGPD art. 19). Não há `requirePermission()` RBAC neste repo ainda (USP-007+),
 * então a checagem é inline: o solicitante precisa de ao menos um destes papéis.
 */
export const ACCESS_REPORT_ROLES = ['SOCIAL_ASSISTANT', 'BOARD', 'COORDINATOR'] as const;

/** Linha do histórico de papéis no relatório. */
export interface AccessReportRoleGrant {
  role: string;
  status: string;
  activatedAt: Date;
  revokedAt: Date | null;
}

/** Linha do histórico de consentimento no relatório (com nome humano + status). */
export interface AccessReportConsent {
  purpose: string;
  purposeName: string;
  status: 'vigente' | 'revogado';
  termVersion: string;
  acceptedAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
}

/** Bloco de perfil do titular consolidado no relatório. */
export interface AccessReportProfile {
  id: string;
  fullName: string;
  cpf: string | null;
  emailLogin: string | null;
  phone: string | null;
  birthDate: Date | null;
  fullAddress: string | null;
  status: string;
  createdAt: Date;
}

/** Relatório de acesso consolidado (perfil + papéis + consentimentos). */
export interface AccessReportResult {
  profile: AccessReportProfile;
  roleGrants: AccessReportRoleGrant[];
  consents: AccessReportConsent[];
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
 *  3. Carrega o titular + papéis + consentimentos (selects explícitos + `take`).
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

  // 3. Carrega o titular + papéis + consentimentos (selects explícitos, `take`).
  const subject = await prisma.person.findUnique({
    where: { id: personId },
    select: {
      id: true,
      fullName: true,
      cpf: true,
      emailLogin: true,
      phone: true,
      birthDate: true,
      fullAddress: true,
      status: true,
      createdAt: true,
      // Art. 19 exige histórico COMPLETO. Mantemos `take` (convenção anti-N+1),
      // mas com tetos altos o suficiente para um titular real nunca ser truncado
      // silenciosamente neste relatório de titular único.
      roleGrants: {
        select: { role: true, status: true, activatedAt: true, revokedAt: true },
        take: 500,
      },
      consents: {
        select: {
          purpose: true,
          termVersion: true,
          acceptedAt: true,
          revokedAt: true,
          revokedReason: true,
        },
        orderBy: { acceptedAt: 'desc' },
        take: 2000,
      },
    },
  });
  if (!subject) {
    return fail('NOT_FOUND', 'Pessoa não encontrada.');
  }

  const profile: AccessReportProfile = {
    id: subject.id,
    fullName: subject.fullName,
    cpf: subject.cpf,
    emailLogin: subject.emailLogin,
    phone: subject.phone,
    birthDate: subject.birthDate,
    fullAddress: subject.fullAddress,
    status: subject.status,
    createdAt: subject.createdAt,
  };

  const roleGrants: AccessReportRoleGrant[] = subject.roleGrants.map((g) => ({
    role: g.role,
    status: g.status,
    activatedAt: g.activatedAt,
    revokedAt: g.revokedAt,
  }));

  const consents: AccessReportConsent[] = subject.consents.map((c) => ({
    purpose: c.purpose,
    purposeName: purposeMetadata(c.purpose).humanName,
    status: c.revokedAt === null ? 'vigente' : 'revogado',
    termVersion: c.termVersion,
    acceptedAt: c.acceptedAt,
    revokedAt: c.revokedAt,
    revokedReason: c.revokedReason,
  }));

  // 4. Contexto da request para o audit_log.
  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  const report: AccessReportResult = {
    profile,
    roleGrants,
    consents,
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
          consents: consents.length,
          roleGrants: roleGrants.length,
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
