'use server';

import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { confirmCvFieldsSchema, type ConfirmCvFieldsInput } from '../schemas/confirm-cv-fields.schema';

export interface ConfirmCvFieldsResult {
  confirmed: true;
}

/**
 * Confirmação humana dos campos extraídos do CV (USP-040 / CVE-04). **Único**
 * caminho que persiste os 5 campos estruturados em `candidate_profiles`
 * (CVE-MN-01 — nem `uploadCv` nem `extractCvFromUpload` gravam nada). Não
 * auto-submete para moderação (A-07): habilita o envio, que segue reusando
 * `submitCandidateForModeration()` (USP-009) como ação separada do candidato.
 *
 * Sequência: Zod → ownership → precondição (perfil existe) →
 * `withAudit(CV_USER_CONFIRMED_FIELDS)`. Nunca lança.
 */
export async function confirmCvFields(
  rawInput: ConfirmCvFieldsInput,
): Promise<ActionResult<ConfirmCvFieldsResult>> {
  const log = childLogger({ module: 'cv-extraction', action: 'confirmCvFields' });

  const parsed = confirmCvFieldsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  const profile = await prisma.candidateProfile.findUnique({
    where: { personId: person.id },
    select: { personId: true },
  });
  if (!profile) {
    return fail('PRECONDITION_FAILED', 'Conclua o cadastro de candidato antes de confirmar o currículo.');
  }

  try {
    await withAudit(
      AuditEvent.CV_USER_CONFIRMED_FIELDS,
      async (tx, audit) => {
        const cvLastConfirmedAt = new Date();
        await tx.candidateProfile.update({
          where: { personId: person.id },
          // Campos ausentes no input (`undefined`) o Prisma trata como "não
          // altera" — confirmação parcial não sobrescreve o que não foi enviado.
          data: {
            educationLevel: data.educationLevel,
            educationArea: data.educationArea,
            experienceText: data.experienceText,
            skillsText: data.skillsText,
            coursesText: data.coursesText,
            cvLastConfirmedAt,
          },
        });

        audit.entityType = 'candidate_profile';
        audit.entityId = person.id;
        audit.after = { cvLastConfirmedAt: cvLastConfirmedAt.toISOString() };
      },
      { actorPersonId: person.id, context: { route: '/candidato' } },
    );

    log.info({ personId: person.id }, 'cv-extraction:fields_confirmed');
    return ok({ confirmed: true });
  } catch (err) {
    log.error({ err, personId: person.id }, 'cv-extraction:confirm_failed');
    return fail('INTERNAL', 'Não foi possível salvar os dados do currículo. Tente novamente.');
  }
}
