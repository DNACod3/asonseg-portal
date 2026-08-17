'use server';

import { headers } from 'next/headers';
import { requirePermission } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { container } from '@/shared/container';
import { fail, ok, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { ContentKind } from '../domain/content-status';
import { PERMISSION_BY_KIND } from '../domain/moderation-permissions';
import { CONTENT_MODERATION_READER_TOKEN } from '../ports/content-moderation-reader.port';
import type { ModerationContentView } from '../views/moderation-content';
import { openContentSchema, type OpenContentInput } from '../schemas/open-content';

const log = childLogger({ module: 'moderation', action: 'openModerationContent' });

const INVALID_INPUT = 'Não foi possível processar a solicitação: dados inválidos.';

/** Campos de {@link ModerationContentView} de `CANDIDATE_PROFILE` que carregam PII (E-005). */
const CANDIDATE_TEXT_FIELDS = [
  'headline',
  'educationLevel',
  'educationArea',
  'experience',
  'skills',
  'courses',
] as const;

/**
 * Serve o conteúdo integral de um item de moderação sob demanda (USP-066 / E-001).
 *
 * Sequência canônica (CLAUDE.md): Zod → `requirePermission(PERMISSION_BY_KIND[kind])`
 * (**P-002** — o reader só é alcançado após o gate; a row restrita nunca é sequer
 * consultada para quem não pode moderar o tipo) → resolve o reader do container →
 * `null` ⇒ `NOT_FOUND` (**E-006**) → `CANDIDATE_PROFILE` audita `SENSITIVE_FIELD_VIEWED`
 * ao servir, **fail-closed** (**E-005**: se a auditoria falhar, o conteúdo não é
 * entregue). Nenhum caminho escreve `status`/`publicationStatus` (**P-005** — esta
 * action é read-only; a única via de mudança de status continua `transitionContent`).
 *
 * Nunca lança — sempre `ActionResult`.
 */
export async function openModerationContent(
  input: OpenContentInput,
): Promise<ActionResult<ModerationContentView>> {
  const parsed = openContentSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', INVALID_INPUT, parsed.error.flatten().fieldErrors);

  const { contentKind, contentId } = parsed.data;

  // P-002: gate autoritativo ANTES de qualquer leitura de conteúdo. Negado ⇒
  // devolve o erro do authz, sem nenhum campo de conteúdo no payload.
  const authz = await requirePermission(PERMISSION_BY_KIND[contentKind]);
  if (!authz.ok) return authz;

  const reader = container.resolve(CONTENT_MODERATION_READER_TOKEN);
  const view = await reader.readContent(contentKind, contentId);
  if (!view) {
    return fail('NOT_FOUND', 'Não foi possível carregar o conteúdo deste item.');
  }

  // E-005: só o perfil de candidato carrega PII sensível (CV/dados pessoais).
  // JOB/SERVICE não auditam (conteúdo "como será publicado", não é PII de Pessoa).
  if (contentKind === ContentKind.CANDIDATE_PROFILE) {
    const viewedFields: string[] = CANDIDATE_TEXT_FIELDS.filter(
      (field) => view.kind === 'CANDIDATE_PROFILE' && view[field] != null,
    );
    const hasCv = view.kind === 'CANDIDATE_PROFILE' && view.cvUrl != null;
    if (hasCv) viewedFields.push('cv');

    // ADR-0004 passo 2 / precedente `list-job-applicants.ts` — captura IP/UA
    // ANTES do `withAudit` (correção A4/PR#294): a mitigação do Risco 1 do
    // ADR-0005 para a URL assinada de CV depende do audit log carregar o IP;
    // `audit_log` é append-only, então o contexto não é recuperável depois.
    const hdrs = await headers();
    const rawIp = clientIp(hdrs);
    const ip = rawIp === 'unknown' ? null : rawIp;
    const userAgent = hdrs.get('user-agent') ?? null;

    try {
      await withAudit(
        AuditEvent.SENSITIVE_FIELD_VIEWED,
        async (_tx, audit) => {
          audit.entityType = 'candidate_profile';
          audit.entityId = contentId;
          audit.context = { viewedFields, hasCv };
        },
        { actorPersonId: authz.data.person.id, ip, userAgent },
      );
    } catch (err) {
      // Fail-closed (E-005): auditoria não gravou ⇒ conteúdo NÃO é entregue.
      log.error({ err, contentId }, 'moderation:open_content:audit_failed');
      return fail('INTERNAL', 'Não foi possível registrar o acesso a este conteúdo. Tente novamente.');
    }
  }

  return ok(view);
}
