import { NextResponse, type NextRequest } from 'next/server';
import { dispatchOutbox } from '@/shared/lib/outbox/dispatch-outbox';
import { env } from '@/shared/env';
import { verifyCronSecret } from '@/shared/lib/cron-secret';
import { childLogger } from '@/shared/lib/logger';

/**
 * Dispatcher assíncrono do Outbox de e-mail (USP-044 — AD-007). Drena a fila
 * `Outbox` onde `topic='email'` (6 sítios de enqueue já gravam linhas; nada em
 * produção as processava antes desta USP). Agendado por um cron EXTERNO
 * (cron-job.org, não Vercel Cron — plano Hobby só permite cron diário nativo),
 * cadência de 1min, design D-4, L-001 ≤60s.
 *
 * Mesmo esqueleto de `expire-jobs`/`auth-attempts-retention` (`verifyCronSecret`):
 * sem `CRON_SECRET` configurado → 503 (fail-closed); segredo ausente/incorreto
 * → 401, zero envios (U44-MN-02); sucesso → 200 `{ sent, failed, skipped }`;
 * erro → 500 + `log.error` estruturado (observabilidade L-003 / RNF 6.6).
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const log = childLogger({ module: 'cron', job: 'dispatch-outbox' });

  const auth = verifyCronSecret(request, env.CRON_SECRET);
  if (auth === 'missing_secret') {
    log.error('CRON_SECRET ausente — dispatcher desabilitado (fail-closed)');
    return NextResponse.json({ ok: false, error: 'CRON_SECRET não configurado' }, { status: 503 });
  }
  if (auth === 'unauthorized') {
    return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });
  }

  log.info('dispatch-outbox: execução iniciada');
  try {
    const { sent, failed, skipped } = await dispatchOutbox();
    log.info({ sent, failed, skipped }, 'dispatch-outbox: execução concluída');
    return NextResponse.json({ ok: true, sent, failed, skipped });
  } catch (err) {
    log.error({ err }, 'dispatch-outbox: falha na execução');
    return NextResponse.json({ ok: false, error: 'Falha ao executar o dispatcher de e-mail' }, { status: 500 });
  }
}
