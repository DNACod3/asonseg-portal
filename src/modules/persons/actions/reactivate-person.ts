'use server';

import { headers } from 'next/headers';
import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import {
  canReactivatePerson,
  type ReactivationDenialReason,
} from '../domain/person-reactivation';
import {
  reactivatePersonSchema,
  type ReactivatePersonInput,
} from '../schemas/reactivate-person.schema';

export interface ReactivatePersonResult {
  personId: string;
  status: 'ATIVO';
  /** Número de grants ATIVOS zerados na mesma transação (E-003 / P-001). */
  grantsRevoked: number;
}

/** Mensagem PT-BR para cada motivo de negativa de autorização. */
const DENIAL_MESSAGES: Record<ReactivationDenialReason, string> = {
  NOT_AUTHORIZED:
    'Apenas coordenadores ou a diretoria podem reativar uma Pessoa.',
  INSUFFICIENT_RANK:
    'Você não pode reativar uma Pessoa que foi inativada por alguém com permissão superior à sua. Acione a diretoria.',
};

const ALREADY_ACTIVE = 'ALREADY_ACTIVE';

/**
 * Reativa uma Pessoa inativada (USP-045 — fluxo inverso da USP-007 / IDN-??).
 *
 * Sequência canônica de Server Action sensível (project-guideline §9):
 *  1. valida entrada (Zod) — `reason` obrigatório (auditoria — L-003);
 *  2. resolve o operador da sessão (`getCurrentPerson` revalida status — ADR-0030);
 *  3. `requirePermission` (inline): `canReactivatePerson` decide a partir do rank
 *     do ator vs. rank do inativador original (USP-045/R1 — hierarquia de permissão;
 *     não abre por baixo o que foi fechado por cima);
 *  4. pré-condições: Pessoa já ativa ⇒ idempotência (CONFLICT);
 *  5. executa em `withAudit('PERSON_REACTIVATED')` — numa única transação:
 *     (a) flipa `status=ATIVO`, limpa metadados de inativação;
 *     (b) **zera grants** (USP-045/R2 / E-003 / P-001): revoga todos os grants
 *         ATIVOS atomicamente — sem esta revogação, o flip de status devolveria
 *         silenciosamente os privilégios anteriores, que é o fracasso central F1;
 *     (c) consentimentos LGPD NÃO são reinstaurados — ficam como estavam
 *         (ADR-0025 / P-003 / F4): re-aceite é ato do titular, não desta action.
 *
 * Login volta a ser aceito na janela de revalidação ≤ 30s (ADR-0030 / E-004).
 *
 * Nunca lança: retorna sempre `ActionResult<ReactivatePersonResult>`.
 */
export async function reactivatePerson(
  rawInput: ReactivatePersonInput,
): Promise<ActionResult<ReactivatePersonResult>> {
  const log = childLogger({ module: 'persons', action: 'reactivatePerson' });

  // 1. Validação de input (Zod) — motivo obrigatório.
  const parsed = reactivatePersonSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const { personId, reason } = parsed.data;

  // 2. Operador da sessão. Revalida status no DB (ADR-0030). Um Pessoa INATIVA
  //    não chega aqui — `getCurrentPerson` retorna null para status !== ATIVO.
  const operator = await getCurrentPerson();
  if (!operator) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // Alvo: leitura mínima para autorização e pré-condição.
  const target = await prisma.person.findUnique({
    where: { id: personId },
    select: {
      id: true,
      status: true,
      inactivatedByPersonId: true,
    },
  });
  if (!target) {
    return fail('NOT_FOUND', 'Pessoa não encontrada.');
  }

  // 4. Pré-condição de idempotência: Pessoa já ativa.
  if (target.status === 'ATIVO') {
    return fail('CONFLICT', 'Esta Pessoa já está ativa.');
  }

  // 3. requirePermission (inline — USP-045/R1):
  //    Busca os papéis ATIVOS atuais do inativador para calcular o rank.
  //    Inativador desconhecido (null) ou sem papéis → rank 0 (não bloqueia).
  let inactivatorRoles: string[] = [];
  if (target.inactivatedByPersonId) {
    const inactivator = await prisma.person.findUnique({
      where: { id: target.inactivatedByPersonId },
      select: {
        roleGrants: { where: { status: 'ACTIVE' }, select: { role: true }, take: 50 },
      },
    });
    if (inactivator) {
      inactivatorRoles = inactivator.roleGrants.map((g) => g.role);
    }
  }

  const authz = canReactivatePerson({
    actorRoles: operator.roles,
    inactivatorRoles,
  });
  if (!authz.allowed) {
    log.warn(
      { actorPersonId: operator.id, targetId: target.id, reason: authz.reason },
      'persons:reactivate_forbidden',
    );
    return fail('FORBIDDEN', DENIAL_MESSAGES[authz.reason]);
  }

  // Contexto da request para a auditoria (IP/UA — sem PII no log).
  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  // 5. Persistência + auditoria atômica.
  try {
    let grantsRevoked = 0;

    await withAudit(
      AuditEvent.PERSON_REACTIVATED,
      async (tx, audit) => {
        // Guard atômico de concorrência (duplo submit): mesmo padrão de
        // `inactivatePerson` — `updateMany` condicional ao `status` atual.
        // O perdedor casa 0 linhas e vira CONFLICT.
        const transition = await tx.person.updateMany({
          where: { id: target.id, status: 'INATIVO' },
          data: {
            status: 'ATIVO',
            // Limpa metadados de inativação: a Pessoa está ativa de novo e a
            // exibição na view não deve mostrar data/motivo de uma inativação
            // já revertida. O histórico completo fica no audit_log (ADR-0008).
            inactivatedAt: null,
            inactivatedByPersonId: null,
            inactivationReason: null,
          },
        });
        if (transition.count === 0) {
          throw Object.assign(new Error(ALREADY_ACTIVE), { code: ALREADY_ACTIVE });
        }

        // Zera grants (USP-045/R2 / E-003 / P-001 — decisão central desta USP).
        // Revoga todos os grants ATIVOS na MESMA transação: sem esta etapa, o
        // flip de status devolveria silenciosamente os privilégios anteriores
        // (fracasso F1 do intent). Consentimentos NÃO são tocados (ADR-0025 / P-003).
        const revoked = await tx.personRoleGrant.updateMany({
          where: { personId: target.id, status: 'ACTIVE' },
          data: {
            status: 'REVOKED',
            revokedAt: new Date(),
            revokedBy: operator.id,
            revocationReason: 'Reativação de Pessoa — grants zerados (USP-045/R2).',
          },
        });
        grantsRevoked = revoked.count;

        audit.entityType = 'person';
        audit.entityId = target.id;
        audit.before = { status: 'INATIVO' };
        audit.after = {
          status: 'ATIVO',
          grantsRevoked: revoked.count,
          consentsPreserved: true,
        };
        audit.justification = reason;
      },
      {
        actorUserId: operator.supabaseUserId,
        actorPersonId: operator.id,
        ip,
        userAgent,
        context: { route: '/pessoas/[id]' },
      },
    );

    log.info(
      { actorPersonId: operator.id, targetId: target.id, grantsRevoked },
      'persons:reactivated',
    );
    return ok({ personId: target.id, status: 'ATIVO', grantsRevoked });
  } catch (err) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === ALREADY_ACTIVE) {
      return fail('CONFLICT', 'Esta Pessoa já está ativa.');
    }
    log.error({ err, targetId: target.id }, 'persons:reactivate_failed');
    return fail('INTERNAL', 'Não foi possível reativar a Pessoa. Tente novamente mais tarde.');
  }
}
