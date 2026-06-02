import { purposeMetadata } from '@/modules/consents';
import { prisma } from '@/shared/lib/prisma';

/**
 * View Model do relatório de acesso (LGPD art. 19 — direito de acesso /
 * ADR-0010). Consolida e **projeta** os dados pessoais de UM titular para
 * disponibilização a um papel interno autorizado.
 *
 * Por que um View Model e não Prisma direto na Server Action: project-guideline
 * §5 / ADR-0010 proíbem ler o Prisma diretamente para devolver os dados de uma
 * Pessoa a **outra** Pessoa. O acesso pleno da diretoria/AS exigido pelo art. 19
 * é exatamente o caminho que a ADR-0010 manda expressar como View Model tipado:
 * a seleção de campos e o shape de saída ficam encapsulados aqui, num único
 * ponto auditável, em vez de espalhados na action.
 *
 * A autorização do solicitante (papel interno) permanece na Server Action — o
 * View Model assume que o chamador já validou quem pode ver.
 */

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

/** Dados consolidados do titular (perfil + papéis + consentimentos). */
export interface AccessReportData {
  profile: AccessReportProfile;
  roleGrants: AccessReportRoleGrant[];
  consents: AccessReportConsent[];
}

/**
 * Carrega e projeta os dados pessoais de um titular para o relatório de acesso.
 * Retorna `null` se o titular não existe (a Server Action mapeia para
 * `NOT_FOUND`). Seleção explícita + `take` (convenção anti-N+1); art. 19 exige
 * histórico COMPLETO, então os tetos são altos o suficiente para um titular real
 * nunca ser truncado silenciosamente neste relatório de titular único.
 */
export async function viewPersonForAccessReport(
  personId: string,
): Promise<AccessReportData | null> {
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
  if (!subject) return null;

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

  return { profile, roleGrants, consents };
}
