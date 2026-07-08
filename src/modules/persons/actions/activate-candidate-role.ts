'use server';

import { headers } from 'next/headers';
import { AuditEvent, withAudit } from '@/modules/audit';
import { requireActiveConsent } from '@/modules/consents';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { getCurrentPerson } from '@/modules/identity';
import { candidateProfileSchema, type CandidateProfileInput } from '../schemas/candidate';

export interface ActivateCandidateRoleResult {
  personId: string;
  publicationStatus: 'DRAFT';
}

/**
 * Cria/atualiza o perfil de candidato em DRAFT (USP-009 / CAD-01, CAD-05).
 *
 * O **papel** CANDIDATE e o **consentimento** `JOB_APPLICATION` são ativados pelo
 * fluxo canônico de papel adicional (`activateAdditionalRole`, USP-006), que
 * registra o consentimento na mesma transação. Esta action é dona apenas do
 * **CandidateProfile** e, conforme o corpo da #44, **verifica** (não regrava) os
 * consentimentos exigidos via `requireActiveConsent`.
 *
 * Sequência: Zod → Pessoa autenticada (P-002, sem `personId` no input) →
 * `requireActiveConsent` (PORTAL_ACCESS + JOB_APPLICATION) → `withAudit` (upsert
 * do perfil em DRAFT). Idempotente: reativar não duplica o perfil (PK = personId)
 * e não rebaixa um perfil que já avançou de status. Nunca lança — retorna `ActionResult`.
 */
export async function activateCandidateRole(
  rawInput: CandidateProfileInput,
): Promise<ActionResult<ActivateCandidateRoleResult>> {
  const log = childLogger({ module: 'persons', action: 'activateCandidateRole' });

  const parsed = candidateProfileSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  // P-002: opera exclusivamente sobre a Pessoa autenticada da sessão.
  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // CAD-05: consentimentos da finalidade devem estar ativos (registrados na
  // ativação do papel — USP-006). Verificação, não regravação. As duas leituras
  // são independentes — paralelizadas para evitar round-trips sequenciais.
  const consents = await Promise.all(
    (['PORTAL_ACCESS', 'JOB_APPLICATION'] as const).map((purpose) =>
      requireActiveConsent(person.id, purpose),
    ),
  );
  if (consents.some((consent) => !consent.active)) {
    return fail(
      'CONSENT_REQUIRED',
      'É necessário aceitar os termos de consentimento para ativar o papel de candidato.',
    );
  }

  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  try {
    await withAudit(
      AuditEvent.CANDIDATE_ROLE_ACTIVATED,
      async (tx, audit) => {
        // Persiste o telefone na Pessoa (não no CandidateProfile — coluna vive em
        // `persons`, é dado de contato da Pessoa, reusável por outros papéis).
        // Débito USP-009 (o form valida `phone` mas nunca gravava): USP-027 precisa
        // do contato real do candidato; corrigido aqui, na mesma transação auditada.
        await tx.person.update({ where: { id: person.id }, data: { phone: data.phone } });

        // Idempotência: upsert por personId. No update, preserva o
        // publication_status atual (não rebaixa um perfil já em moderação/ativo).
        await tx.candidateProfile.upsert({
          where: { personId: person.id },
          create: {
            personId: person.id,
            headline: data.headline ?? null,
            primaryAreaOfInterestId: data.primaryAreaOfInterestId,
            educationLevel: data.educationLevel,
            educationArea: data.educationArea ?? null,
            experienceText: data.experienceText ?? null,
            skillsText: data.skillsText ?? null,
            coursesText: data.coursesText ?? null,
            availability: data.availability ?? null,
            // publicationStatus: DRAFT (default do schema)
          },
          update: {
            headline: data.headline ?? null,
            primaryAreaOfInterestId: data.primaryAreaOfInterestId,
            educationLevel: data.educationLevel,
            educationArea: data.educationArea ?? null,
            experienceText: data.experienceText ?? null,
            skillsText: data.skillsText ?? null,
            coursesText: data.coursesText ?? null,
            availability: data.availability ?? null,
          },
        });

        audit.entityType = 'candidate_profile';
        audit.entityId = person.id;
        audit.after = { publicationStatus: 'DRAFT', educationLevel: data.educationLevel };
      },
      { actorPersonId: person.id, ip, userAgent, context: { route: '/candidato' } },
    );

    log.info({ personId: person.id }, 'persons:candidate_role_activated');
    return ok({ personId: person.id, publicationStatus: 'DRAFT' });
  } catch (err) {
    log.error({ err, personId: person.id }, 'persons:candidate_role_activation_failed');
    return fail('INTERNAL', 'Não foi possível salvar o cadastro. Tente novamente mais tarde.');
  }
}
