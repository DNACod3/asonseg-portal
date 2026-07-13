import type { AuditTx } from '@/modules/audit';
import { env } from '@/shared/env';
import type { EmailMessage } from '@/shared/lib/email/email-sender.port';
import { childLogger } from '@/shared/lib/logger';
import { ContentKind, ContentStatus } from '../domain/content-status';
import type {
  ModerationDecisionNotice,
  ModerationNotificationPort,
} from '../ports/moderation-notification.port';

/** As 3 únicas decisões do moderador que disparam e-mail (USP057-MN-01). */
const DECISION_TARGETS: ReadonlySet<ContentStatus> = new Set([
  ContentStatus.ACTIVE,
  ContentStatus.AWAITING_ADJUSTMENTS,
  ContentStatus.REJECTED,
]);

/** Rótulo PT-BR do tipo + caminho da área do autor, por `ContentKind` (USP057-04).
 *  `CV` (fixture, sem autor real) fica de fora do mapa → no-op (USP057-07). */
const CONTENT_KIND_META: Partial<Record<ContentKind, { label: string; areaPath: string }>> = {
  [ContentKind.JOB]: { label: 'vaga', areaPath: '/empresa' },
  [ContentKind.SERVICE]: { label: 'serviço', areaPath: '/prestador' },
  [ContentKind.CANDIDATE_PROFILE]: { label: 'perfil de candidato', areaPath: '/candidato' },
};

interface ResolvedContent {
  authorPersonId: string;
  title: string;
}

/** Resolve autor + título por `ContentKind`, via o cliente transacional recebido. */
async function resolveContent(
  tx: AuditTx,
  contentKind: ContentKind,
  contentId: string,
): Promise<ResolvedContent | null> {
  switch (contentKind) {
    case ContentKind.JOB: {
      const job = await tx.job.findUnique({
        where: { id: contentId },
        select: { title: true, authorPersonId: true },
      });
      return job ? { authorPersonId: job.authorPersonId, title: job.title } : null;
    }
    case ContentKind.SERVICE: {
      const service = await tx.service.findUnique({
        where: { id: contentId },
        select: { title: true, authorPersonId: true },
      });
      return service ? { authorPersonId: service.authorPersonId, title: service.title } : null;
    }
    case ContentKind.CANDIDATE_PROFILE: {
      // Perfil de candidato é auto-submetido: authorPersonId === contentId (personId).
      const profile = await tx.candidateProfile.findUnique({
        where: { personId: contentId },
        select: { headline: true },
      });
      return profile ? { authorPersonId: contentId, title: profile.headline ?? 'Perfil de candidato' } : null;
    }
    case ContentKind.CV:
    default:
      return null;
  }
}

/**
 * Adapter real do {@link ModerationNotificationPort} (USP-057 — substitui o
 * stub GAP-3/USP-044). Resolve o autor + título por `ContentKind`, monta o
 * `EmailMessage` de decisão e **enfileira** no Outbox via `tx.outbox.create`,
 * na mesma transação da decisão de moderação — nunca envia/despacha
 * (dispatch = USP-044, USP057-MN-03).
 *
 * Gate (USP057-MN-01): só as 3 decisões do moderador (`IN_MODERATION` →
 * `ACTIVE`/`AWAITING_ADJUSTMENTS`/`REJECTED`) enfileiram e-mail. Demais
 * transições (pausar/despausar/arquivar/expirar/reenvio/inativação) são no-op.
 *
 * No-op (sem lançar, USP057-07) quando: `ContentKind` sem mapeamento de área
 * (CV/fixture), conteúdo não encontrado, ou autor sem `emailLogin`. O `payload`
 * nunca carrega dado do moderador (`actorPersonId` do notice) nem PII sensível
 * (USP057-MN-04) — só nome do autor, tipo, título, motivo e o link.
 */
export class OutboxModerationNotification implements ModerationNotificationPort {
  private readonly log = childLogger({ module: 'moderation', adapter: 'outbox-notification' });

  async sendModerationDecision(tx: AuditTx, notice: ModerationDecisionNotice): Promise<void> {
    if (notice.from !== ContentStatus.IN_MODERATION || !DECISION_TARGETS.has(notice.to)) {
      return; // USP057-MN-01: não é uma das 3 decisões do moderador.
    }

    const meta = CONTENT_KIND_META[notice.contentKind];
    if (!meta) {
      this.log.info(
        { contentKind: notice.contentKind, contentId: notice.contentId },
        'moderation:notification:outbox:no-area-mapping (CV/fixture — sem autor real)',
      );
      return; // USP057-07
    }

    const resolved = await resolveContent(tx, notice.contentKind, notice.contentId);
    if (!resolved) {
      this.log.info(
        { contentKind: notice.contentKind, contentId: notice.contentId },
        'moderation:notification:outbox:content-not-found',
      );
      return;
    }

    const person = await tx.person.findUnique({
      where: { id: resolved.authorPersonId },
      select: { emailLogin: true, fullName: true },
    });
    if (!person?.emailLogin) {
      this.log.info(
        { contentKind: notice.contentKind, contentId: notice.contentId },
        'moderation:notification:outbox:no-email-skip',
      );
      return; // USP057-07: autor sem emailLogin — no-op logado.
    }

    const areaUrl = `${env.NEXT_PUBLIC_SITE_URL}${meta.areaPath}`;
    const base = {
      autorNome: person.fullName,
      tipoConteudo: meta.label,
      tituloConteudo: resolved.title,
      areaUrl,
    };

    // USP057-MN-02: `tx` recebido — nunca `prisma` global (rollback ⇒ sem órfão).
    // USP057-MN-03: nunca resolve/chama o EmailSender — só enfileira. `satisfies`
    // (não uma variável anotada `EmailMessage`) mantém o tipo literal do objeto,
    // aceito pelo `Json` do Prisma — mesmo padrão de `apply-to-job.ts`.
    switch (notice.to) {
      case ContentStatus.ACTIVE: {
        const message = { to: person.emailLogin, template: 'moderation-approved', data: base } satisfies EmailMessage;
        await tx.outbox.create({ data: { topic: 'email', payload: message } });
        return;
      }
      case ContentStatus.AWAITING_ADJUSTMENTS: {
        const message = {
          to: person.emailLogin,
          template: 'moderation-returned',
          data: { ...base, motivo: notice.justification ?? '' },
        } satisfies EmailMessage;
        await tx.outbox.create({ data: { topic: 'email', payload: message } });
        return;
      }
      case ContentStatus.REJECTED: {
        const message = {
          to: person.emailLogin,
          template: 'moderation-rejected',
          data: { ...base, motivo: notice.justification ?? '' },
        } satisfies EmailMessage;
        await tx.outbox.create({ data: { topic: 'email', payload: message } });
        return;
      }
      default:
        return; // inalcançável — DECISION_TARGETS já restringe a estes 3 valores.
    }
  }
}
