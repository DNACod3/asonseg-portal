import { prisma } from '@/shared/lib/prisma';
import { childLogger } from '@/shared/lib/logger';
import { container } from '@/shared/container';
import { EMAIL_SENDER_TOKEN, type EmailSender, type EmailMessage } from '@/shared/lib/email/email-sender.port';
import { resolveOutboxEmail } from './resolve-outbox-email';

/** Tamanho do lote por ciclo — paginação obrigatória (CLAUDE.md), design D-3. */
export const BATCH_SIZE = 50;

/** Cap de retentativas — linha que atinge o cap vira poison, excluída da seleção (U44-MN-03). */
export const MAX_ATTEMPTS = 5;

export interface DispatchOutboxResult {
  /** Linhas enviadas com sucesso (`processedAt` marcado). */
  sent: number;
  /** Linhas que falharam no envio (attempts incrementado, `processedAt` continua nulo — retry no próximo ciclo). */
  failed: number;
  /** Linhas resolvidas como no-op gracioso (entidade/destinatário ausente; `processedAt` marcado, sem retry). */
  skipped: number;
  /** Total de linhas efetivamente reivindicadas por esta execução (sent+failed+skipped). */
  claimed: number;
}

type ResolvePayloadFn = (payload: unknown) => Promise<EmailMessage | null>;

export interface DispatchOutboxDeps {
  /** Injeta a porta `EmailSender` nos testes (nunca `ResendEmailSender` concreto); default resolve via `container`. */
  emailSender?: EmailSender;
  /** Injeta o resolver de payload nos testes; default `resolveOutboxEmail` (que por sua vez resolve o hidratador de `jobs` via `container`). */
  resolvePayload?: ResolvePayloadFn;
}

/** `attempts < MAX_ATTEMPTS` — a regra de cap que exclui a linha poison da seleção (U44-MN-03). */
export function isClaimable(attempts: number): boolean {
  return attempts < MAX_ATTEMPTS;
}

type ClaimOutcome = 'sent' | 'failed' | 'skipped' | 'locked' | 'error';

/**
 * Drena a fila `Outbox` onde `topic='email'` (USP-044 / E-001 / AC-044-D1..D6).
 *
 * Seleciona um lote limitado de linhas committed (`processedAt IS NULL AND
 * attempts < MAX_ATTEMPTS`, mais antigas primeiro), e para CADA linha abre uma
 * transação curta própria com `SELECT ... FOR UPDATE SKIP LOCKED`: resolve o
 * payload, envia via a porta `EmailSender` **dentro do lock**, e marca o
 * resultado na MESMA transação (claim+send+mark atômicos). Isso garante que
 * duas execuções concorrentes reivindicam conjuntos DISJUNTOS de linhas — a
 * garantia é de nível de banco (o lock), não um pré-check de aplicação
 * (U44-MN-01 / L-010).
 *
 * Isolamento por linha (U44-MN-03): a falha de uma linha nunca aborta o laço
 * do lote — as demais são processadas normalmente. Nunca loga corpo/PII, só
 * metadado (`outboxId`, `template`/`kind`, status, `attempts` — U44-MN-04).
 */
export async function dispatchOutbox(deps: DispatchOutboxDeps = {}): Promise<DispatchOutboxResult> {
  const log = childLogger({ module: 'outbox', job: 'dispatch-outbox' });
  const emailSender = deps.emailSender ?? container.resolve(EMAIL_SENDER_TOKEN);
  const resolvePayload = deps.resolvePayload ?? resolveOutboxEmail;

  const candidates = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM outbox
    WHERE topic = 'email' AND processed_at IS NULL AND attempts < ${MAX_ATTEMPTS}
    ORDER BY created_at ASC
    LIMIT ${BATCH_SIZE}
  `;

  const result: DispatchOutboxResult = { sent: 0, failed: 0, skipped: 0, claimed: 0 };

  for (const { id } of candidates) {
    const outcome = await claimAndProcessRow(id, emailSender, resolvePayload, log);
    // 'locked' = outra execução concorrente já reivindicou esta linha (U44-MN-01).
    // 'error' = falha inesperada na própria transação (ex.: conexão) — a linha não
    // foi efetivamente reivindicada (rollback), então não conta como claimed.
    if (outcome === 'locked' || outcome === 'error') continue;
    result[outcome]++;
    result.claimed++;
  }

  log.info(
    { sent: result.sent, failed: result.failed, skipped: result.skipped, claimed: result.claimed },
    'outbox:dispatch_completed',
  );
  return result;
}

/**
 * Reivindica UMA linha via `FOR UPDATE SKIP LOCKED` dentro de uma transação
 * curta própria, resolve+envia dentro do lock, e marca o resultado na MESMA
 * transação. `timeout` estendido (10s) porque o envio de e-mail (I/O de rede)
 * roda dentro da transação — trade-off documentado em design.md (at-least-once
 * sob crash, aceito para e-mail informativo).
 */
async function claimAndProcessRow(
  id: string,
  emailSender: EmailSender,
  resolvePayload: ResolvePayloadFn,
  log: ReturnType<typeof childLogger>,
): Promise<ClaimOutcome> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string; payload: unknown }>>`
          SELECT id, payload FROM outbox
          WHERE id = ${id}::uuid AND processed_at IS NULL
          FOR UPDATE SKIP LOCKED
        `;
        const row = rows[0];
        if (!row) {
          return 'locked';
        }

        let message: EmailMessage | null;
        try {
          message = await resolvePayload(row.payload);
        } catch (err) {
          await tx.outbox.update({
            where: { id },
            data: { attempts: { increment: 1 }, lastError: errorMessage(err) },
          });
          log.warn({ outboxId: id, status: 'failed' }, 'outbox:dispatch_row_failed');
          return 'failed';
        }

        if (message === null) {
          await tx.outbox.update({ where: { id }, data: { processedAt: new Date() } });
          log.info({ outboxId: id, status: 'skipped' }, 'outbox:dispatch_row_skipped');
          return 'skipped';
        }

        const sendResult = await emailSender.send(message);
        if (sendResult.ok) {
          await tx.outbox.update({ where: { id }, data: { processedAt: new Date() } });
          log.info({ outboxId: id, template: message.template, status: 'sent' }, 'outbox:dispatch_row_sent');
          return 'sent';
        }

        await tx.outbox.update({
          where: { id },
          data: { attempts: { increment: 1 }, lastError: 'EmailSender retornou ok:false' },
        });
        log.warn({ outboxId: id, template: message.template, status: 'failed' }, 'outbox:dispatch_row_failed');
        return 'failed';
      },
      { timeout: 10_000 },
    );
  } catch (err) {
    log.error({ outboxId: id, err: errorMessage(err) }, 'outbox:dispatch_row_error');
    return 'error';
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
