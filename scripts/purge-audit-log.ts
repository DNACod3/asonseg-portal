/**
 * Job mensal de purge do `audit_log` (US #12 — retenção de 1 ano, ADR-0004).
 *
 * Agendamento: cron mensal (Vercel Cron / Supabase scheduled job). Local/manual:
 *   npm run db:purge-audit
 *
 * Conecta via DIRECT_URL (role com privilégio de DELETE — o app role não tem,
 * por ADR-T-0004). O trigger append-only é liberado pela própria função via
 * `SET LOCAL app.audit_purge`. Ver retenção/hardening de role em infra #205.
 */
import { PrismaClient } from '@prisma/client';
import { purgeExpiredAuditLogs } from '@/modules/audit';

async function main(): Promise<void> {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  const client = new PrismaClient({ datasources: { db: { url } } });

  try {
    const { deleted, cutoff } = await purgeExpiredAuditLogs(new Date(), client);
    console.log(`audit_log purge concluído: ${deleted} registro(s) removido(s) (corte < ${cutoff.toISOString()}).`);
  } finally {
    await client.$disconnect();
  }
}

main().catch((e) => {
  console.error('Falha no purge de audit_log:', e);
  process.exit(1);
});
