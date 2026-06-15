'use server';

import crypto from 'node:crypto';
import { headers } from 'next/headers';
import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { currentTermVersion, loadTerm } from '@/modules/consents';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import {
  acceptResponsibleLinkSchema,
  type AcceptResponsibleLinkInput,
} from '../schemas/accept-responsible-link.schema';

export interface AcceptResponsibleLinkResult {
  status: 'ACTIVE';
}

/**
 * A Pessoa adicionada aceita um vínculo de responsável pendente (USP-013).
 *
 * A identidade vem SEMPRE da sessão (P-002 — o link de e-mail não autentica).
 * Atomicamente (ADR-0020 / P-003), na mesma transação:
 *  - o vínculo PENDING vira ACTIVE (acceptedAt = now);
 *  - o consentimento da finalidade 5 (COMPANY_REPRESENTATION) é capturado;
 *  - o papel COMPANY_RESPONSIBLE é ativado na Pessoa (se inativo) — só ACTIVE
 *    depois do consent persistido (mesma invariante de ensureClientRole).
 *
 * Aceite sem vínculo PENDING (já aceito, removido ou inexistente, ou de outra
 * Pessoa) → bloqueado (idempotência defensiva).
 */
export async function aceitarVinculoResponsavel(
  rawInput: AcceptResponsibleLinkInput,
): Promise<ActionResult<AcceptResponsibleLinkResult>> {
  const log = childLogger({ module: 'companies', action: 'aceitarVinculoResponsavel' });

  // 1. Validação.
  const parsed = acceptResponsibleLinkSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const { empresaId } = parsed.data;

  // 2. Pessoa autenticada — é a Pessoa do vínculo (a sessão, não o link).
  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // 3. Pré-condição: existe vínculo PENDING desta Pessoa nesta Empresa.
  // A consulta por personId garante que só a própria Pessoa aceita o seu vínculo.
  const pending = await prisma.personCompanyGrant.findFirst({
    where: {
      personId: person.id,
      companyId: empresaId,
      grantType: 'RESPONSIBLE',
      status: 'PENDING',
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!pending) {
    return fail(
      'PRECONDITION_FAILED',
      'Não há convite pendente de aceite para esta Empresa (já aceito, removido ou inexistente).',
    );
  }

  // Termo vigente da finalidade 5 (carregado/validado server-side antes da tx).
  const term = await loadTerm('COMPANY_REPRESENTATION', currentTermVersion('COMPANY_REPRESENTATION'));

  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  // 4. Aceite atômico: vínculo ACTIVE + consent finalidade 5 + papel COMPANY_RESPONSIBLE.
  try {
    await withAudit(
      AuditEvent.COMPANY_RESPONSIBLE_LINK_ACCEPTED,
      async (tx, audit) => {
        // 4a. Releitura defensiva + flip PENDING → ACTIVE (fecha corrida de duplo aceite).
        const flip = await tx.personCompanyGrant.updateMany({
          where: {
            id: pending.id,
            status: 'PENDING',
            revokedAt: null,
          },
          data: { status: 'ACTIVE', acceptedAt: new Date() },
        });
        if (flip.count === 0) {
          throw Object.assign(new Error('NO_PENDING'), { code: 'NO_PENDING' });
        }

        // 4b. Consent finalidade 5 (ANTES de ativar o papel — invariante P-003).
        const activeConsent = await tx.consent.findFirst({
          where: { personId: person.id, purpose: 'COMPANY_REPRESENTATION', revokedAt: null },
          select: { id: true },
        });
        if (!activeConsent) {
          const consentId = crypto.randomUUID();
          await tx.consent.create({
            data: {
              id: consentId,
              personId: person.id,
              purpose: 'COMPANY_REPRESENTATION',
              termVersion: term.version,
              termContentHash: term.hash,
              acceptedIp: ip,
              userAgent,
              context: { companyId: empresaId, via: 'responsible_link_accept' },
            },
            select: { id: true },
          });
          await tx.auditLog.create({
            data: {
              action: AuditEvent.CONSENT_GRANTED,
              actorPersonId: person.id,
              entityType: 'consent',
              entityId: consentId,
              ip,
              userAgent,
              after: { purpose: 'COMPANY_REPRESENTATION', termVersion: term.version, via: 'responsible_link_accept' },
            },
            select: { id: true },
          });
        }

        // 4c. Ativa o papel COMPANY_RESPONSIBLE (se ainda não ativo). Só vira ACTIVE
        // após o consent acima (mesma ordem AWAITING_CONSENT → consent → ACTIVE).
        const existingRole = await tx.personRoleGrant.findFirst({
          where: { personId: person.id, role: 'COMPANY_RESPONSIBLE' },
          orderBy: { activatedAt: 'desc' },
          select: { id: true, status: true },
        });
        if (!existingRole || existingRole.status !== 'ACTIVE') {
          const roleId = existingRole?.id ?? crypto.randomUUID();
          if (!existingRole) {
            await tx.personRoleGrant.create({
              data: { id: roleId, personId: person.id, role: 'COMPANY_RESPONSIBLE', status: 'AWAITING_CONSENT' },
              select: { id: true },
            });
          }
          await tx.personRoleGrant.update({
            where: { id: roleId },
            data: {
              status: 'ACTIVE',
              activatedAt: new Date(),
              activatedBy: person.id,
              revokedAt: null,
              revokedBy: null,
              revocationReason: null,
            },
            select: { id: true },
          });
        }

        audit.entityType = 'person_company_grant';
        audit.entityId = pending.id;
        audit.after = { personId: person.id, companyId: empresaId, status: 'ACTIVE' };
      },
      {
        actorUserId: person.supabaseUserId,
        actorPersonId: person.id,
        ip,
        userAgent,
        context: { route: '/empresa/aceitar-vinculo' },
      },
    );

    log.info({ actorPersonId: person.id, companyId: empresaId }, 'companies:responsible_link_accepted');
    return ok({ status: 'ACTIVE' });
  } catch (err) {
    if (err instanceof Error && (err as { code?: string }).code === 'NO_PENDING') {
      return fail('PRECONDITION_FAILED', 'Este convite não está mais pendente.');
    }
    const errCode = err instanceof Error ? (err as NodeJS.ErrnoException).code ?? err.message : String(err);
    log.error({ errCode }, 'companies:accept_responsible_link_failed');
    return fail('INTERNAL', 'Não foi possível aceitar o vínculo. Tente novamente mais tarde.');
  }
}
