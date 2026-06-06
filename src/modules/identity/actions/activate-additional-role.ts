'use server';

import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { headers } from 'next/headers';
import { AuditEvent, withAudit } from '@/modules/audit';
import { loadTerm, TermLoaderError } from '@/modules/consents';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { getCurrentPerson } from '../server/session';
import { ROLE_PURPOSE_MAP, type PublicRole } from '../schemas/registerPerson';
import {
  missingProfileFields,
  ROLE_LABELS,
  ROLE_NEXT_STEP,
  type ProfileField,
} from '../domain/role-activation';
import {
  activateAdditionalRoleSchema,
  type ActivateAdditionalRoleInput,
} from '../schemas/activate-role.schema';

export interface ActivateAdditionalRoleResult {
  role: PublicRole;
  status: 'ACTIVE';
  /** Próximo passo do papel ativado (E-004) — o cliente redireciona para cá. */
  nextStep: string;
}

/**
 * Ativa um papel público adicional para a Pessoa autenticada (USP-006 / IDN-14).
 *
 * Sequência canônica de Server Action sensível:
 *  1. valida entrada (Zod);
 *  2. resolve a Pessoa autenticada — **exclusivamente** a da sessão (P-002: nenhum
 *     `personId` vem do input, então não há vetor de sequestro lateral);
 *  3. pré-condições: papel ainda não ativo (idempotência); campos faltantes do
 *     perfil do papel todos preenchidos (E-001); o termo vigente da finalidade é
 *     **carregado e validado server-side** (`loadTerm` recalcula o SHA-256 e o
 *     confere contra o registro — P-004 / L-002), nunca confiando na versão/hash
 *     vindos do cliente (que servem só como checagem otimista do que a Pessoa viu);
 *  4. executa tudo em `withAudit('ROLE_GRANT_ACTIVATED')` — numa **única
 *     transação** (ADR-0020 / P-001): completa o perfil, cria/reaproveita o grant
 *     em `AWAITING_CONSENT`, persiste o `Consent` da finalidade vinculada (com a
 *     versão/hash computados no servidor) e só então promove o grant a `ACTIVE`
 *     (sem moderação do papel — E-003; a máquina de moderação da ADR-0011 não se
 *     aplica a papéis públicos).
 *
 * Invariante (P-001): o grant nunca chega a `ACTIVE` sem o consentimento da
 * finalidade persistido na MESMA transação. Nunca lança: retorna `ActionResult`.
 */
export async function activateAdditionalRole(
  rawInput: ActivateAdditionalRoleInput,
): Promise<ActionResult<ActivateAdditionalRoleResult>> {
  const log = childLogger({ module: 'identity', action: 'activateAdditionalRole' });

  const parsed = activateAdditionalRoleSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;
  const role = input.role;
  const purpose = ROLE_PURPOSE_MAP[role];

  // P-002: a operação é sempre sobre a Pessoa autenticada da sessão.
  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // Pré-condição: papel já ativo ⇒ idempotência (sem reativar nem duplicar grant).
  if (person.roles.includes(role)) {
    return fail('CONFLICT', `Você já possui o papel ${ROLE_LABELS[role]} ativo.`);
  }

  // Campos faltantes decididos sobre o snapshot já carregado pela sessão (E-001) —
  // `getCurrentPerson` já traz `phone`/`fullAddress`, então não há segunda leitura
  // da Pessoa. Só os campos realmente ausentes são exigidos; todos devem vir.
  const missing = missingProfileFields(person, role);
  const fieldErrors: Record<string, string[]> = {};
  const profileData: Partial<Record<ProfileField, string>> = {};
  for (const field of missing) {
    const value = input.profile[field];
    if (!value || value.trim() === '') {
      fieldErrors[`profile.${field}`] = ['Campo obrigatório para ativar este papel'];
    } else {
      profileData[field] = value.trim();
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return fail('VALIDATION', 'Preencha os dados faltantes do papel.', fieldErrors);
  }

  // P-004 / L-002: o termo vigente é carregado e validado SERVER-SIDE — `loadTerm`
  // recalcula o SHA-256 e o confere contra o registro. A versão/hash que vão para o
  // `Consent` são SEMPRE os do servidor; os do cliente entram apenas como checagem
  // otimista (o aceite tem de corresponder ao termo que a Pessoa de fato viu).
  let term;
  try {
    term = await loadTerm(purpose);
  } catch (err) {
    if (err instanceof TermLoaderError) {
      log.error({ purpose, code: err.code }, 'identity:additional_role_term_unavailable');
      return fail(
        'PRECONDITION_FAILED',
        'Termo desta finalidade indisponível no momento. Tente novamente mais tarde.',
      );
    }
    throw err;
  }
  if (input.termVersion !== term.version || input.termContentHash !== term.hash) {
    return fail(
      'CONFLICT',
      'O termo desta finalidade foi atualizado. Recarregue a página e revise o novo termo antes de ativar.',
    );
  }

  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;
  const newConsentId = crypto.randomUUID();

  try {
    await withAudit(
      AuditEvent.ROLE_GRANT_ACTIVATED,
      async (tx, audit) => {
        // Releitura defensiva na TX: fecha a corrida de duplo submit (papel já ativo).
        const alreadyActive = await tx.personRoleGrant.findFirst({
          where: { personId: person.id, role, status: 'ACTIVE' },
          select: { id: true },
        });
        if (alreadyActive) {
          throw Object.assign(new Error('ROLE_ALREADY_ACTIVE'), { code: 'ROLE_ALREADY_ACTIVE' });
        }

        // Completa o perfil com os campos faltantes preenchidos (E-001).
        if (Object.keys(profileData).length > 0) {
          await tx.person.update({ where: { id: person.id }, data: profileData });
        }

        // Reaproveita um grant pendente/inativo do papel ou cria um novo, sempre
        // partindo de AWAITING_CONSENT (estado intermediário do fluxo — ADR-0020:
        // o grant só chega a ACTIVE com o consent persistido na MESMA transação).
        const existing = await tx.personRoleGrant.findFirst({
          where: { personId: person.id, role },
          orderBy: { activatedAt: 'desc' },
          select: { id: true },
        });
        const grantId = existing?.id ?? crypto.randomUUID();
        if (!existing) {
          await tx.personRoleGrant.create({
            data: { id: grantId, personId: person.id, role, status: 'AWAITING_CONSENT' },
            select: { id: true },
          });
        }

        // P-001: consentimento da finalidade na MESMA transação. Reaproveita um
        // consentimento já ativo (caso raro pós-cascata) — o índice único parcial
        // `consents_active_purpose_unique` impede dois ativos por finalidade.
        const activeConsent = await tx.consent.findFirst({
          where: { personId: person.id, purpose, revokedAt: null },
          select: { id: true },
        });
        let consentId = activeConsent?.id ?? newConsentId;
        if (!activeConsent) {
          await tx.consent.create({
            data: {
              id: newConsentId,
              personId: person.id,
              purpose,
              termVersion: term.version,
              termContentHash: term.hash,
              acceptedIp: ip,
              userAgent,
            },
            select: { id: true },
          });
          consentId = newConsentId;
          await tx.auditLog.create({
            data: {
              action: AuditEvent.CONSENT_GRANTED,
              actorPersonId: person.id,
              entityType: 'consent',
              entityId: consentId,
              ip,
              userAgent,
              after: { purpose, termVersion: term.version, via: 'role_activation' },
            },
            select: { id: true },
          });
        }

        // Só agora o papel vira ACTIVE — sem moderação do papel (E-003; a máquina
        // de moderação da ADR-0011 não se aplica a papéis públicos).
        await tx.personRoleGrant.update({
          where: { id: grantId },
          data: {
            status: 'ACTIVE',
            activatedAt: new Date(),
            activatedBy: person.id,
            revokedAt: null,
            revokedBy: null,
            revocationReason: null,
          },
        });

        audit.entityType = 'person_role_grant';
        audit.entityId = grantId;
        audit.after = {
          role,
          status: 'ACTIVE',
          purpose,
          termVersion: term.version,
          consentId,
          profileCompleted: Object.keys(profileData),
        };
      },
      { actorPersonId: person.id, ip, userAgent, context: { route: '/perfil/papeis' } },
    );

    log.info({ personId: person.id, role, purpose }, 'identity:additional_role_activated');
    return ok({ role, status: 'ACTIVE', nextStep: ROLE_NEXT_STEP[role] });
  } catch (err) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ROLE_ALREADY_ACTIVE') {
      return fail('CONFLICT', `Você já possui o papel ${ROLE_LABELS[role]} ativo.`);
    }
    // P2002: corrida no índice único parcial de consentimento ativo da finalidade.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      log.warn({ personId: person.id, purpose }, 'identity:additional_role_consent_race');
      return fail('CONFLICT', 'Operação concorrente detectada. Recarregue a página e tente novamente.');
    }
    log.error({ err, role }, 'identity:additional_role_failed');
    return fail('INTERNAL', 'Não foi possível ativar o papel. Tente novamente mais tarde.');
  }
}
