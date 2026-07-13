import {
  AuditEvent,
  type AuditContext,
  type AuditEventName,
  type AuditFn,
  type AuditRecorder,
  type AuditTx,
  recordAuditEvent,
  withAudit,
} from '@/modules/audit';
import { revalidateHomeIndicators } from '@/modules/reporting';
import { container } from '@/shared/container';
import { fail, ok, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { ContentKind, ContentStatus, type TransitionTrigger } from '../domain/content-status';
import { isMeaningfulJustification } from '../domain/justification';
import { isValidTransition, requiresJustification } from '../domain/transition-rules';
import { CONTENT_STATUS_REPOSITORY_TOKEN } from '../ports/content-status.port';
import { MODERATION_NOTIFICATION_TOKEN } from '../ports/moderation-notification.port';
import { CACHE_INVALIDATION_TOKEN } from '../ports/cache-invalidation.port';
import { COMPANY_VERIFY_HOOK_TOKEN } from '../ports/company-verify-hook.port';

const log = childLogger({ module: 'moderation', fn: 'transitionContent' });

export interface TransitionContentInput {
  contentKind: ContentKind;
  contentId: string;
  to: ContentStatus;
  trigger: TransitionTrigger;
  justification?: string;
  /** Ator no plano de domínio (Pessoa) — registrado na auditoria (AC5 / L-003). */
  actorPersonId: string;
  /** IP/User-Agent de origem — propagados ao `audit_log` quando fornecidos (paridade com `withAudit`). */
  ip?: string | null;
  userAgent?: string | null;
  /**
   * Transação já aberta pelo chamador (ex.: cascata de revogação de consentimento
   * — USP-053/CAND-7 "OCULTAR"). Quando fornecida, `transitionContent` participa
   * dela via {@link recordAuditEvent} em vez de abrir a própria com `withAudit` —
   * mesmo padrão de threading de `tx` externo já aplicado ao
   * `ModerationNotificationPort.sendModerationDecision(tx, …)` (USP-057) um nível
   * abaixo. Callers de moderação normal (sem `tx`) continuam abrindo a própria
   * transação — comportamento inalterado (retrocompatível).
   */
  tx?: AuditTx;
}

export interface TransitionContentData {
  from: ContentStatus;
  to: ContentStatus;
}

/** Conflito de concorrência otimista — sinaliza rollback dentro da transação. */
class TransitionConflictError extends Error {}

/**
 * Função canônica de mudança de status de conteúdo (ADR-0011 — **única via**;
 * AC6 / P-006). Nenhuma camada faz `prisma.<model>.update({ status })` direto.
 *
 * Sequência: carrega status → valida transição (regras puras #121) → exige motivo
 * significativo quando aplicável (P-003) → aplica em `withAudit` (status + audit
 * log na **mesma transação**, AC5 / L-003) com concorrência otimista (R3) →
 * dispara side effects soft-fail (e-mail, cache) e o hook de Empresa (R2 / GAP-4)
 * → **fora** da tx, após o commit, revalida os indicadores da home pública
 * quando `to === ACTIVE` (USP-041 / T6 / D-005): é o único chokepoint real
 * dos 3 eventos de origem — vaga aprovada, perfil de candidato ativado e
 * verificação de Empresa (efeito colateral do `CompanyVerifyHook` acima,
 * também disparado só em `ACTIVE`) passam todos por aqui (ADR-0011 —
 * única via de mudança de status).
 *
 * Nunca lança — retorna `ActionResult`.
 */
export async function transitionContent(
  input: TransitionContentInput,
): Promise<ActionResult<TransitionContentData>> {
  const { contentKind, contentId, to, trigger } = input;
  const repo = container.resolve(CONTENT_STATUS_REPOSITORY_TOKEN);

  // 1. Estado atual.
  const from = await repo.loadStatus(contentKind, contentId);
  if (from == null) {
    return fail('NOT_FOUND', 'Conteúdo não encontrado para moderação.');
  }

  // 2. Validar transição contra a máquina de estados (AC6).
  if (!isValidTransition(contentKind, from, to, trigger)) {
    return fail('INVALID_TRANSITION', 'Esta transição de status não é permitida.');
  }

  // 3. Motivo significativo quando a transição exige (P-003).
  const justification = input.justification?.trim() || undefined;
  if (requiresJustification(contentKind, from, to, trigger) && !isMeaningfulJustification(justification)) {
    return fail('JUSTIFICATION_REQUIRED', 'Informe um motivo descritivo para esta decisão.');
  }

  const event = eventTypeFor(contentKind, from, to, trigger);
  if (!event) {
    log.error({ contentKind, from, to, trigger }, 'moderation:transition:no-audit-event');
    return fail('INTERNAL', 'Não foi possível registrar a decisão.');
  }

  // 4–5. Aplicar em transação com auditoria + side effects. Extraído para
  // `AuditFn` nomeado (em vez de literal inline) porque os dois caminhos abaixo
  // (tx própria via `withAudit` / tx externa via `recordAuditEvent`) reusam o
  // mesmo callback — só a forma de abrir/participar da transação muda.
  const applyTransition: AuditFn<TransitionContentData> = async (tx, audit) => {
    const applied = await repo.updateStatus(tx, contentKind, contentId, from, to);
    if (!applied) {
      // Status já mudou (decisão concorrente) — aborta a transação (R3).
      throw new TransitionConflictError();
    }

    audit.entityType = contentKind;
    audit.entityId = contentId;
    audit.before = { status: from };
    audit.after = { status: to };
    audit.justification = justification ?? null;

    // Side effects soft-fail: falha não aborta a transição (R2). `tx`
    // threaded ao port (USP-057) — enqueue eager na mesma transação
    // (AD-007/P-007), espelhando o hook de Empresa abaixo.
    await runSoftFail('notification', () =>
      container.resolve(MODERATION_NOTIFICATION_TOKEN).sendModerationDecision(tx, {
        contentKind,
        contentId,
        from,
        to,
        justification,
        actorPersonId: input.actorPersonId,
      }),
    );
    await runSoftFail('cache', () =>
      container
        .resolve(CACHE_INVALIDATION_TOKEN)
        .revalidateForContent({ contentKind, contentId, from, to }),
    );

    // Hook de Empresa (USP-017) — writes transacionais acoplados à decisão
    // (ADR-0024): verificação na 1ª vaga aprovada / contador na rejeição.
    if (to === ContentStatus.ACTIVE) {
      await container.resolve(COMPANY_VERIFY_HOOK_TOKEN).onContentActivated(tx, {
        contentKind,
        contentId,
        from,
        actorPersonId: input.actorPersonId,
      });
    } else if (to === ContentStatus.REJECTED) {
      await container.resolve(COMPANY_VERIFY_HOOK_TOKEN).onContentRejected(tx, {
        contentKind,
        contentId,
        from,
        actorPersonId: input.actorPersonId,
      });
    }

    return { from, to };
  };

  const auditCtx: AuditContext = {
    actorPersonId: input.actorPersonId,
    ip: input.ip,
    userAgent: input.userAgent,
    context: { contentKind, contentId },
  };

  try {
    // `tx` externo (USP-053/CAND-7 remediação de review — "OCULTAR" via FSM em
    // vez de `updateMany` cru): participa da transação já aberta pelo chamador
    // via `recordAuditEvent`, em vez de `withAudit` abrir a própria (que
    // rejeitaria — Prisma não aninha `$transaction`). Sem `tx`, comportamento
    // idêntico ao anterior (própria transação via `withAudit`).
    const data = input.tx
      ? await (async (tx: AuditTx) => {
          const audit: AuditRecorder = {};
          const result = await applyTransition(tx, audit);
          await recordAuditEvent(tx, event, audit, auditCtx);
          return result;
        })(input.tx)
      : await withAudit(event, applyTransition, auditCtx);

    // USP-041/T6 (E-002/D-005): revalidação da home fora da tx —
    // `revalidatePath` não é transacional. Só quando a transição pode mover
    // um dos 3 contadores da home (vaga aprovada, perfil de candidato
    // ativado, verificação de Empresa). Soft-fail: o piso ISR de 600s
    // (REL41-MN-03) é o backstop de correção se isto falhar.
    if (data.to === ContentStatus.ACTIVE) {
      try {
        revalidateHomeIndicators();
      } catch (err) {
        log.warn({ err }, 'moderation:transition:home-indicators-revalidate-failed');
      }
    }

    return ok(data);
  } catch (err) {
    if (err instanceof TransitionConflictError) {
      // Segunda decisão concorrente: trata como transição inválida (item já mudou).
      return fail('INVALID_TRANSITION', 'Este item já foi atualizado por outra decisão.');
    }
    log.error({ err, contentKind, contentId, from, to }, 'moderation:transition:failed');
    return fail('INTERNAL', 'Não foi possível concluir a decisão de moderação.');
  }
}

/**
 * Mapeia (tipo de conteúdo + origem + destino + gatilho) para o evento de auditoria
 * do catálogo (`@/modules/audit/events`). Kind-aware (USP-023/T1, estendido em
 * USP-029/T029-2): o ramo comum (moderação) vale para qualquer `ContentKind`; os
 * ramos `JOB`/`SERVICE` cobrem o ciclo de vida pós-publicação (pausar/despausar/
 * arquivar/expirar). `JOB` também expira (`SYSTEM_JOB`); `SERVICE` não tem EXPIRED
 * (sem validade automática — épico servicos, out-of-scope USP-024). Kinds sem ramo
 * próprio (CV/CANDIDATE_PROFILE) preservam o comportamento anterior — `null` para
 * os destinos fora do ramo comum (sem regressão).
 */
function eventTypeFor(
  contentKind: ContentKind,
  from: ContentStatus,
  to: ContentStatus,
  trigger: TransitionTrigger,
): AuditEventName | null {
  switch (to) {
    case ContentStatus.ACTIVE:
      if (trigger === 'MODERATOR_ACTION') return AuditEvent.CONTENT_APPROVED;
      if (from === ContentStatus.PAUSED && trigger === 'AUTHOR_ACTION') {
        if (contentKind === ContentKind.JOB) return AuditEvent.JOB_UNPAUSED;
        if (contentKind === ContentKind.SERVICE) return AuditEvent.SERVICE_UNPAUSED;
      }
      return null;
    case ContentStatus.AWAITING_ADJUSTMENTS:
      return AuditEvent.CONTENT_RETURNED_FOR_ADJUSTMENTS;
    case ContentStatus.REJECTED:
      return AuditEvent.CONTENT_REJECTED;
    case ContentStatus.IN_MODERATION:
      return AuditEvent.CONTENT_SUBMITTED_TO_MODERATION;
    case ContentStatus.INACTIVATED:
      return AuditEvent.CONTENT_INACTIVATED_BY_COORDINATOR;
    case ContentStatus.PAUSED:
      if (trigger !== 'AUTHOR_ACTION') return null;
      if (contentKind === ContentKind.JOB) return AuditEvent.JOB_PAUSED;
      if (contentKind === ContentKind.SERVICE) return AuditEvent.SERVICE_PAUSED;
      // USP-053/CAND-7 (remediação Fase 8): "OCULTAR" passou a usar a FSM em vez
      // de um `updateMany` direto — precisa de evento próprio para ser auditável
      // (antes caía no `return null` genérico → INTERNAL, kind nunca chamava aqui).
      if (contentKind === ContentKind.CANDIDATE_PROFILE) return AuditEvent.CANDIDATE_PROFILE_PAUSED;
      return null;
    case ContentStatus.ARCHIVED:
      if (trigger !== 'AUTHOR_ACTION') return null;
      if (contentKind === ContentKind.JOB) return AuditEvent.JOB_ARCHIVED;
      if (contentKind === ContentKind.SERVICE) return AuditEvent.SERVICE_ARCHIVED;
      return null;
    case ContentStatus.EXPIRED:
      return contentKind === ContentKind.JOB && trigger === 'SYSTEM_JOB' ? AuditEvent.JOB_EXPIRED : null;
    default:
      return null;
  }
}

/** Executa um side effect engolindo (e logando) falhas — soft-fail (ADR-0011 R2). */
async function runSoftFail(label: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (err) {
    log.warn({ err, sideEffect: label }, 'moderation:transition:side-effect-soft-fail');
  }
}
