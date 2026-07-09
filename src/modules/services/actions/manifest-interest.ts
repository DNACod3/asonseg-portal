'use server';

import { headers } from 'next/headers';
import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit, recordAuditEvent } from '@/modules/audit';
import { requireActiveConsent, loadTerm, TermLoaderError } from '@/modules/consents';
import { ensureClientRole } from '@/modules/persons';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import type { EmailMessage } from '@/shared/lib/email/email-sender.port';
import { isServiceOpenForInterest } from '../domain/service-interest-rules';
import { manifestInterestSchema, type ManifestInterestInput } from '../schemas/service-interest.schema';
import { providerDisplayName } from '../views/provider-display';
import { viewProviderContactForClient, type ProviderContact } from '../views/provider-contact.view';

export interface ManifestInterestResult {
  interestId: string;
  providerContact: ProviderContact;
}

/** Corrida de duplicidade — a linha ativa da manifestação foi criada por outra requisição concorrente. */
class ManifestConflictError extends Error {}

/**
 * Manifesta interesse da Pessoa autenticada (papel cliente, ativado
 * automaticamente na 1ª vez) num serviço ativo (USP-033 / AC-033-1..5).
 * Self-service — sem `requirePermission` (A-4/AD-017): não há `PermissionId`
 * de manifestação no catálogo; o gate é sessão + consentimento `SERVICE_HIRING`
 * + pré-condições de negócio.
 *
 * Sequência: Zod → `getCurrentPerson` → carrega o serviço (o contato do autor é
 * SELECTado aqui, mas só é RETORNADO no sucesso) → `isServiceOpenForInterest`
 * (SVC033-MN-05) → auto-manifestação bloqueada (SVC033-MN-04) →
 * `requireActiveConsent(SERVICE_HIRING)` (AC-033-4) → pré-check de UX de
 * duplicidade → `withAudit(INTEREST_MANIFESTED)`: `ensureClientRole` (ativa o
 * papel CLIENT + consent na MESMA tx, AC-033-2/SVC033-MN-02) + cria a
 * `ServiceInterest` (garantia real = índice único parcial, SVC033-MN-03) +
 * enfileira o e-mail ao prestador (Outbox, AD-007) + audita a revelação de
 * contato (`PROVIDER_CONTACT_REVEALED`). Nunca lança.
 */
export async function manifestInterest(
  rawInput: ManifestInterestInput,
): Promise<ActionResult<ManifestInterestResult>> {
  const log = childLogger({ module: 'services', action: 'manifestInterest' });

  const parsed = manifestInterestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const { serviceId, consentAccepted } = parsed.data;

  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // O contato do autor é SELECTado aqui (necessário para montar o Outbox e o
  // retorno de sucesso), mas só é RETORNADO ao cliente quando a manifestação
  // é de fato persistida (o cliente se torna entitled ao commitar) — nunca antes.
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      id: true,
      status: true,
      authorPersonId: true,
      title: true,
      author: { select: { inactivatedAt: true, fullName: true, phone: true, emailLogin: true } },
      company: { select: { nomeFantasia: true } },
    },
  });
  if (!service) {
    return fail('NOT_FOUND', 'Serviço não encontrado.');
  }

  if (!isServiceOpenForInterest({ status: service.status, authorInactivatedAt: service.author.inactivatedAt })) {
    return fail('PRECONDITION_FAILED', 'Este serviço não está mais disponível.');
  }

  if (service.authorPersonId === person.id) {
    return fail('PRECONDITION_FAILED', 'Você não pode manifestar interesse no próprio serviço.');
  }

  const consent = await requireActiveConsent(person.id, 'SERVICE_HIRING');
  if (!consent.active && consentAccepted !== true) {
    return fail(
      'CONSENT_REQUIRED',
      'É necessário aceitar o consentimento de contratação de serviços antes de continuar.',
    );
  }

  let term;
  try {
    term = await loadTerm('SERVICE_HIRING');
  } catch (err) {
    if (err instanceof TermLoaderError) {
      log.error({ code: err.code }, 'services:manifest_interest_term_unavailable');
      return fail(
        'PRECONDITION_FAILED',
        'Termo de contratação de serviços indisponível no momento. Tente novamente mais tarde.',
      );
    }
    throw err;
  }

  // Pré-check de UX (não é a garantia — ver docstring). Sob corrida, ambas as
  // requisições podem passar aqui; o índice único parcial decide no COMMIT.
  const existingActive = await prisma.serviceInterest.findFirst({
    where: { serviceId, clientPersonId: person.id, cancelledAt: null },
    select: { id: true },
  });
  if (existingActive) {
    return fail('CONFLICT', 'Você já manifestou interesse neste serviço.');
  }

  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  const providerContact = viewProviderContactForClient({
    displayName: providerDisplayName(service),
    phone: service.author.phone,
    email: service.author.emailLogin,
  });

  try {
    const interestId = await withAudit(
      AuditEvent.INTEREST_MANIFESTED,
      async (tx, audit) => {
        await ensureClientRole(tx, {
          personId: person.id,
          term: { version: term.version, hash: term.hash },
          ip,
          userAgent,
        });

        let created;
        try {
          created = await tx.serviceInterest.create({
            data: { serviceId, clientPersonId: person.id },
            select: { id: true },
          });
        } catch (err) {
          if (err instanceof Error && (err as { code?: string }).code === 'P2002') {
            throw new ManifestConflictError();
          }
          throw err;
        }

        if (service.author.emailLogin) {
          const message = {
            to: service.author.emailLogin,
            template: 'service-interest-notification',
            data: {
              prestadorNome: service.author.fullName,
              servicoTitulo: service.title,
              clienteNome: person.fullName,
            },
          } satisfies EmailMessage;
          await tx.outbox.create({ data: { topic: 'email', payload: message } });
        }

        await recordAuditEvent(
          tx,
          AuditEvent.PROVIDER_CONTACT_REVEALED,
          {
            entityType: 'service',
            entityId: serviceId,
            after: { interestId: created.id },
          },
          { actorPersonId: person.id, ip, userAgent, context: { serviceId } },
        );

        audit.entityType = 'SERVICE_INTEREST';
        audit.entityId = created.id;
        audit.after = { serviceId, clientPersonId: person.id };
        return created.id;
      },
      { actorUserId: person.supabaseUserId, actorPersonId: person.id, ip, userAgent, context: { serviceId } },
    );

    log.info({ actorPersonId: person.id, serviceId, interestId }, 'services:interest_manifested');
    return ok({ interestId, providerContact });
  } catch (err) {
    if (err instanceof ManifestConflictError || (err instanceof Error && (err as { code?: string }).code === 'P2002')) {
      return fail('CONFLICT', 'Você já manifestou interesse neste serviço.');
    }
    log.error({ err, serviceId }, 'services:manifest_interest_failed');
    return fail('INTERNAL', 'Não foi possível registrar sua manifestação de interesse. Tente novamente mais tarde.');
  }
}
