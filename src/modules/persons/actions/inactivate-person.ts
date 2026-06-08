'use server';

import { headers } from 'next/headers';
import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { container } from '@/shared/container';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { COMPANY_RESPONSIBILITY_TOKEN } from '../ports/companyResponsibility';
import {
  canInactivatePerson,
  type InactivationDenialReason,
} from '../domain/person-inactivation';
import {
  inactivatePersonSchema,
  type InactivatePersonInput,
} from '../schemas/inactivate-person.schema';

export interface InactivatePersonResult {
  personId: string;
  status: 'INATIVO';
}

/** Mensagem PT-BR para cada motivo de negativa de autorização (E-001). */
const DENIAL_MESSAGES: Record<InactivationDenialReason, string> = {
  NOT_AUTHORIZED:
    'Apenas coordenadores (para voluntários) ou a diretoria podem inativar uma Pessoa.',
  COORDINATOR_SCOPE:
    'Coordenadores só podem inativar voluntários. Para inativar esta Pessoa, acione a diretoria.',
  SELF_INACTIVATION:
    'Você não pode inativar a si mesmo(a) — peça a outro responsável para fazê-lo.',
};

const ALREADY_INACTIVE = 'ALREADY_INACTIVE';

/**
 * Inativa uma Pessoa preservando o histórico (USP-007 / IDN-15, IDN-16).
 *
 * Sequência canônica de Server Action sensível (project-guideline §9):
 *  1. valida entrada (Zod) — `reason` é obrigatório (auditoria — L-004);
 *  2. resolve o operador da sessão (`getCurrentPerson` revalida status — ADR-0030);
 *  3. `requirePermission` (inline, sensível ao alvo): `canInactivatePerson`
 *     decide a partir dos papéis do ator E do alvo (diretoria → qualquer Pessoa;
 *     coordenador → só voluntários; ninguém inativa a si mesmo);
 *  4. pré-condições: (a) Pessoa já inativa ⇒ idempotência (CONFLICT); (b) **P-002 /
 *     E-003** — se for único responsável ativo de alguma Empresa, bloqueia até
 *     designar outro responsável (resolvido pelo `CompanyResponsibilityPort`);
 *  5. executa em `withAudit('PERSON_INACTIVATED')` — numa única transação:
 *     flipa `status=INATIVO` + carimba `inactivatedAt/By/Reason`. **Nada é
 *     apagado** (ADR-0008 / P-003 / P-005): grants, consentimentos, candidaturas
 *     e todo o histórico permanecem; a inatividade já os torna inertes (a sessão
 *     não resolve acesso — `getCurrentPerson`), e a reativação (USP-045) cuida do
 *     reset dos grants. Bloqueio de login/sessão é efeito do `status` (E-001 /
 *     P-001 / L-002 via ADR-0030 — login e revalidação por request já checam).
 *
 * Nunca lança: retorna sempre `ActionResult<InactivatePersonResult>`.
 *
 * **Fora de escopo (gate D-003):** o ramo "pedido do titular sob LGPD" (E-004 /
 * P-004 — comunicação que distingue desativação de acesso × eliminação de dados)
 * é uma porta de entrada própria, condicionada à revisão jurídica do texto; não
 * vai a produção por aqui. Esta action cobre o fluxo interno (coordenador/diretoria).
 */
export async function inactivatePerson(
  rawInput: InactivatePersonInput,
): Promise<ActionResult<InactivatePersonResult>> {
  const log = childLogger({ module: 'persons', action: 'inactivatePerson' });

  // 1. Validação de input (Zod) — motivo obrigatório.
  const parsed = inactivatePersonSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const { personId, reason } = parsed.data;

  // 2. Operador da sessão. `getCurrentPerson` revalida status no DB (ADR-0030) e
  //    devolve apenas papéis ATIVOS.
  const operator = await getCurrentPerson();
  if (!operator) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // Alvo: leitura mínima (status + papéis ativos) para a decisão de autorização.
  // Não é exibição de dados de uma Pessoa a outra (não há View Model envolvido) —
  // é uma checagem server-only de autorização/pré-condição.
  const target = await prisma.person.findUnique({
    where: { id: personId },
    select: {
      id: true,
      status: true,
      roleGrants: { where: { status: 'ACTIVE' }, select: { role: true }, take: 50 },
    },
  });
  if (!target) {
    return fail('NOT_FOUND', 'Pessoa não encontrada.');
  }
  const targetRoles = target.roleGrants.map((g) => g.role);

  // 3. requirePermission (inline, sensível ao alvo).
  const authz = canInactivatePerson({
    actorId: operator.id,
    actorRoles: operator.roles,
    targetId: target.id,
    targetRoles,
  });
  if (!authz.allowed) {
    log.warn(
      { actorPersonId: operator.id, targetId: target.id, reason: authz.reason },
      'persons:inactivate_forbidden',
    );
    return fail('FORBIDDEN', DENIAL_MESSAGES[authz.reason]);
  }

  // 4a. Idempotência: Pessoa já inativa.
  if (target.status === 'INATIVO') {
    return fail('CONFLICT', 'Esta Pessoa já está inativa.');
  }

  // 4b. P-002 / E-003: único responsável ativo de Empresa bloqueia a inativação.
  //     O port resolve as Empresas que ficariam órfãs (vazio enquanto não há
  //     módulo `companies`). A checagem precede a inativação (não corrige depois).
  const companyResponsibility = container.resolve(COMPANY_RESPONSIBILITY_TOKEN);
  const orphaned = await companyResponsibility.companiesLeftWithoutResponsible(target.id);
  if (orphaned.length > 0) {
    const names = orphaned.map((c) => c.name).join(', ');
    log.warn(
      { actorPersonId: operator.id, targetId: target.id, orphanedCount: orphaned.length },
      'persons:inactivate_blocked_sole_responsible',
    );
    return fail(
      'PRECONDITION_FAILED',
      `Esta Pessoa é a única responsável por: ${names}. Designe outro responsável ativo para essa(s) Empresa(s) antes de inativá-la.`,
    );
  }

  // Contexto da request para a auditoria (IP/UA — sem PII no log).
  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  // 5. Persistência + auditoria atômica.
  try {
    await withAudit(
      AuditEvent.PERSON_INACTIVATED,
      async (tx, audit) => {
        // Releitura defensiva na TX: fecha a corrida de duplo submit.
        const fresh = await tx.person.findUnique({
          where: { id: target.id },
          select: { status: true },
        });
        if (!fresh || fresh.status === 'INATIVO') {
          throw Object.assign(new Error(ALREADY_INACTIVE), { code: ALREADY_INACTIVE });
        }

        await tx.person.update({
          where: { id: target.id },
          data: {
            status: 'INATIVO',
            inactivatedAt: new Date(),
            inactivatedByPersonId: operator.id,
            inactivationReason: reason,
          },
          select: { id: true },
        });

        // Histórico preservado (ADR-0008 / P-003 / P-005): nenhum delete, nenhum
        // grant/consent revogado aqui — a inatividade já os torna inertes e a
        // reativação (USP-045) reseta os grants.
        audit.entityType = 'person';
        audit.entityId = target.id;
        audit.before = { status: 'ATIVO' };
        audit.after = { status: 'INATIVO', historyPreserved: true, consentsPreserved: true };
        // Motivo na coluna dedicada `justification` (não-redigida) — L-004.
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
      { actorPersonId: operator.id, targetId: target.id },
      'persons:inactivated',
    );
    return ok({ personId: target.id, status: 'INATIVO' });
  } catch (err) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === ALREADY_INACTIVE) {
      return fail('CONFLICT', 'Esta Pessoa já está inativa.');
    }
    log.error({ err, targetId: target.id }, 'persons:inactivate_failed');
    return fail('INTERNAL', 'Não foi possível inativar a Pessoa. Tente novamente mais tarde.');
  }
}
