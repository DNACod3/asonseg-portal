import { headers } from 'next/headers';
import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, recordAuditEvent } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { canManageSocioeconomicRecord } from '../domain/socioeconomic-record';
import { viewSocioeconomicRecord, type SocioeconomicRecordView } from '../views/view-socioeconomic-record';

/**
 * Lê a ficha socioeconômica de uma Pessoa, restrita a AS/BOARD, com
 * audit-on-read (USP-036 / SOC-02, SOC-036-MN-01, Assumption #8).
 *
 * Sequência (leitura sensível, espelha `listProviderInterests`):
 *  1. sessão — `getCurrentPerson` (ADR-0030);
 *  2. guarda de papel `canManageSocioeconomicRecord` **antes** do `SELECT`
 *     (SOC-036-MN-01 — o `select` explícito nem roda para quem não tem acesso;
 *     "anonimizar no View Model não basta" — lição de projeto sobre RSC/Flight);
 *  3. `SELECT` explícito (só os campos da ficha) — `null` = Pessoa sem ficha
 *     ainda (não é erro);
 *  4. quando a ficha existe, audita `SENSITIVE_FIELD_VIEWED` (Assumption #8 —
 *     "log de toda alteração e acesso"). Ficha inexistente não gera auditoria
 *     de leitura (nenhum campo sensível foi de fato exposto).
 *
 * Nunca lança — sempre `ActionResult`.
 */
export async function getSocioeconomicRecord(
  personId: string,
): Promise<ActionResult<SocioeconomicRecordView | null>> {
  const log = childLogger({ module: 'persons', query: 'getSocioeconomicRecord' });

  const operator = await getCurrentPerson();
  if (!operator) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // SOC-036-MN-01: guarda ANTES do SELECT — nenhum campo sensível é carregado
  // para quem não tem papel autorizado.
  if (!canManageSocioeconomicRecord(operator.roles)) {
    log.warn(
      { actorPersonId: operator.id, roles: operator.roles, targetId: personId },
      'persons:get_socioeconomic_record_forbidden',
    );
    return fail(
      'FORBIDDEN',
      'Apenas assistentes sociais ou diretoria podem acessar a ficha socioeconômica.',
    );
  }

  const row = await prisma.socioeconomicRecord.findUnique({
    where: { personId },
    select: {
      personId: true,
      incomeBracket: true,
      socialBenefit: true,
      housingSituation: true,
      familyComposition: true,
      updatedAt: true,
      updatedByPersonId: true,
    },
  });

  // Pessoa sem ficha ainda — não é erro, e nada sensível foi exposto (sem auditoria).
  if (!row) {
    return ok(null);
  }

  const view = viewSocioeconomicRecord(row);

  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  try {
    await prisma.$transaction(async (tx) => {
      await recordAuditEvent(
        tx,
        AuditEvent.SENSITIVE_FIELD_VIEWED,
        {
          entityType: 'person',
          entityId: personId,
          context: {
            viewedFields: ['incomeBracket', 'socialBenefit', 'housingSituation', 'familyComposition'],
            via: 'socioeconomic_record',
          },
        },
        { actorUserId: operator.supabaseUserId, actorPersonId: operator.id, ip, userAgent },
      );
    });
  } catch (err) {
    log.error({ err, targetId: personId }, 'persons:get_socioeconomic_record_audit_failed');
    return fail('INTERNAL', 'Erro interno. Tente novamente mais tarde.');
  }

  return ok(view);
}
