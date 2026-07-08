import { NextResponse, type NextRequest } from 'next/server';
import { runJobExpiration } from '@/modules/jobs';
import { env } from '@/shared/env';
import { verifyCronSecret } from '@/shared/lib/cron-secret';
import { childLogger } from '@/shared/lib/logger';

/**
 * Job de expiração automática de vaga (USP-024 — E-001/G1/L-001). Transiciona toda vaga
 * `ACTIVE` cuja validade passou para `EXPIRED` via `transitionContent` (defesa em
 * profundidade complementar ao filtro on-read de `searchJobs`/`getActiveJobDetail`).
 * Agendado pelo Vercel Cron (`vercel.json`, `0 * * * *` — cadência horária, L-001).
 *
 * Mesmo padrão de proteção de `auth-attempts-retention` (clonado, `verifyCronSecret`):
 * sem `CRON_SECRET` configurado → 503 (fail-closed); segredo ausente/incorreto → 401,
 * zero transições (U24-MN-06); sucesso → 200 `{ expired, scanned }`; erro → 500 + `log.error`
 * estruturado (observabilidade L-003 / RNF 6.6).
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const log = childLogger({ module: 'cron', job: 'expire-jobs' });

  const auth = verifyCronSecret(request, env.CRON_SECRET);
  if (auth === 'missing_secret') {
    log.error('CRON_SECRET ausente — job desabilitado (fail-closed)');
    return NextResponse.json({ ok: false, error: 'CRON_SECRET não configurado' }, { status: 503 });
  }
  if (auth === 'unauthorized') {
    return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });
  }

  log.info('expire-jobs: execução iniciada');
  try {
    const { expired, scanned } = await runJobExpiration();
    log.info({ expired, scanned }, 'expire-jobs: execução concluída');
    return NextResponse.json({ ok: true, expired, scanned });
  } catch (err) {
    log.error({ err }, 'expire-jobs: falha na execução');
    return NextResponse.json({ ok: false, error: 'Falha ao executar a expiração de vagas' }, { status: 500 });
  }
}
