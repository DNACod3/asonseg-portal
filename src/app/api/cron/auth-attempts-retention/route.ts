import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { env } from '@/shared/env';
import { prisma } from '@/shared/lib/prisma';
import { childLogger } from '@/shared/lib/logger';
import { verifyCronSecret } from '@/shared/lib/cron-secret';

/**
 * Job de retenção de `auth_attempts` (USP-004 — T-11, L-006).
 *
 * Apaga tentativas de login mais antigas que `AUTH_ATTEMPTS_RETENTION_DAYS`
 * (default 90 dias), evitando o crescimento indefinido da tabela técnica de
 * lockout. Agendado pelo Vercel Cron (ver `vercel.json`, 03:00 diário).
 *
 * Proteção: exige o header `x-cron-secret` igual a `CRON_SECRET` (ou o
 * `Authorization: Bearer <CRON_SECRET>` que o Vercel Cron injeta). Sem o segredo
 * configurado, responde 503 (fail-closed) para não expor um DELETE anônimo.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const log = childLogger({ module: 'cron', job: 'auth-attempts-retention' });

  const auth = verifyCronSecret(request, env.CRON_SECRET);
  if (auth === 'missing_secret') {
    log.error('CRON_SECRET ausente — job desabilitado (fail-closed)');
    return NextResponse.json({ ok: false, error: 'CRON_SECRET não configurado' }, { status: 503 });
  }
  if (auth === 'unauthorized') {
    return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });
  }

  const days = env.AUTH_ATTEMPTS_RETENTION_DAYS;
  // Intervalo é parametrizado mas seguro: `days` é um inteiro positivo validado
  // pelo Zod (shared/env). Usa interpolação só no literal numérico do INTERVAL.
  const deleted = await prisma.$executeRaw(
    Prisma.sql`DELETE FROM auth_attempts WHERE attempted_at < NOW() - (${days} * INTERVAL '1 day')`,
  );

  log.info({ deleted, retentionDays: days }, 'auth-attempts retention executado');
  return NextResponse.json({ ok: true, deleted });
}
