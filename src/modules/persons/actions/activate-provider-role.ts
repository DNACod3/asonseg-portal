'use server';

import { headers } from 'next/headers';
import { AuditEvent, withAudit } from '@/modules/audit';
import { requireActiveConsent } from '@/modules/consents';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { getCurrentPerson } from '@/modules/identity';
import { providerProfileSchema, type ProviderProfileInput } from '../schemas/provider';

export interface ActivateProviderRoleResult {
  personId: string;
  publicationStatus: 'DRAFT';
}

/**
 * Cria/atualiza o perfil de prestador de serviço PF em DRAFT (USP-010 / CAD-06).
 *
 * O **papel** PROVIDER e o **consentimento** `SERVICE_OFFERING` são ativados pelo
 * fluxo canônico de papel adicional (`activateAdditionalRole`, USP-006), que
 * registra o consentimento na mesma transação (P-003). Esta action é dona apenas
 * do **ProviderProfile** e **verifica** (não regrava) os consentimentos exigidos
 * via `requireActiveConsent`.
 *
 * Diferenças vs. USP-009: papel ativo **imediatamente, sem moderação** (ADR-0015)
 * — não há `transitionContent`/`submitForModeration`; e **sem coleta de CNPJ**
 * (ADR-0031) — declarar MEI redireciona ao fluxo USP-012 na UI.
 *
 * Sequência: Zod → Pessoa autenticada (P-005, sem `personId` no input) →
 * `requireActiveConsent` (PORTAL_ACCESS + SERVICE_OFFERING) → `withAudit` (upsert
 * do perfil em DRAFT). Idempotente: reativar não duplica o perfil (PK = personId)
 * e não rebaixa um perfil que já avançou de status. Nunca lança — retorna `ActionResult`.
 */
export async function activateProviderRole(
  rawInput: ProviderProfileInput,
): Promise<ActionResult<ActivateProviderRoleResult>> {
  const log = childLogger({ module: 'persons', action: 'activateProviderRole' });

  const parsed = providerProfileSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  // P-005: opera exclusivamente sobre a Pessoa autenticada da sessão.
  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // CAD-06: consentimentos da finalidade devem estar ativos (registrados na
  // ativação do papel — USP-006). Verificação, não regravação. As duas leituras
  // são independentes — paralelizadas para evitar round-trips sequenciais.
  const consents = await Promise.all(
    (['PORTAL_ACCESS', 'SERVICE_OFFERING'] as const).map((purpose) =>
      requireActiveConsent(person.id, purpose),
    ),
  );
  if (consents.some((consent) => !consent.active)) {
    return fail(
      'CONSENT_REQUIRED',
      'É necessário aceitar os termos de consentimento para ativar o papel de prestador.',
    );
  }

  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  try {
    await withAudit(
      AuditEvent.PROVIDER_ROLE_ACTIVATED,
      async (tx, audit) => {
        // Idempotência: upsert por personId. No update, preserva o
        // publication_status atual (não rebaixa um perfil já publicado).
        await tx.providerProfile.upsert({
          where: { personId: person.id },
          create: {
            personId: person.id,
            headline: data.headline ?? null,
            description: data.description ?? null,
            regionId: data.regionId ?? null,
            // publicationStatus: DRAFT (default do schema)
          },
          update: {
            headline: data.headline ?? null,
            description: data.description ?? null,
            regionId: data.regionId ?? null,
          },
        });

        audit.entityType = 'provider_profile';
        audit.entityId = person.id;
        audit.after = { publicationStatus: 'DRAFT', regionId: data.regionId ?? null };
      },
      { actorPersonId: person.id, ip, userAgent, context: { route: '/prestador' } },
    );

    log.info({ personId: person.id }, 'persons:provider_role_activated');
    return ok({ personId: person.id, publicationStatus: 'DRAFT' });
  } catch (err) {
    log.error({ err, personId: person.id }, 'persons:provider_role_activation_failed');
    return fail('INTERNAL', 'Não foi possível salvar o cadastro. Tente novamente mais tarde.');
  }
}
