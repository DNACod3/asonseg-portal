'use server';

import { headers } from 'next/headers';
import { renderToBuffer } from '@react-pdf/renderer';
import { AuditEvent, withAudit } from '@/modules/audit';
import { getCurrentPerson, type DelegatedGrant } from '@/modules/identity';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { formatSaoPaulo } from '@/shared/lib/time';
import { prisma } from '@/shared/lib/prisma';
import { canViewSocialReports } from '../domain/report-access';
import { isReportTypeAuthorized } from '../domain/report-authorization';
import { composeWatermark, toCsv } from '../domain/csv';
import { buildReportRows } from '../queries/build-report-rows';
import { ReportPdfDocument } from '../components/report-pdf';
import { exportReportSchema, type ExportReportInput } from '../schemas/export-report';
import { REPORT_TITLES } from '../domain/report-titles';

/**
 * `exportReport` (T11) — export CSV/PDF de um relatório operacional,
 * seguindo a sequência canônica de Server Action sensível (project-guideline
 * §9 / design.md §6):
 *  1. Zod (`exportReportSchema`).
 *  2. RBAC por `reportType` (guards T1) — nega ⇒ `FORBIDDEN`, **sem arquivo**
 *     (REL42-MN-03). R5 (`moderation_queue`) via `MODERATE_JOB/CV/SERVICE`
 *     (P-006).
 *  3. Ciência de responsabilidade LGPD (P-008/REL42-MN-06) — só exigida
 *     quando o relatório TEM PII (hoje: `social` visto por AS/BOARD — a
 *     versão stripped do coordenador nunca carrega PII).
 *  4. Roda a query, monta CSV (T4, watermark se PII) ou PDF (`report-pdf.tsx`).
 *  5. `withAudit('REPORT_EXPORTED', ...)` — quem/reportType/filtros/escopo
 *     PII (nunca valores PII — minimização do `withAudit`). Falha do audit
 *     ⇒ rollback (REL42-MN-07). Nunca lança — sempre `ActionResult`.
 */

export interface ExportPayload {
  format: 'CSV' | 'PDF';
  filename: string;
  mimeType: string;
  /** CSV: texto UTF-8 direto. PDF: bytes em base64 (Server Actions só serializam JSON-safe). */
  content: string;
}

const MODERATION_PERMISSIONS = ['MODERATE_JOB', 'MODERATE_CV', 'MODERATE_SERVICE'] as const;

export async function exportReport(rawInput: ExportReportInput): Promise<ActionResult<ExportPayload>> {
  const log = childLogger({ module: 'reporting', action: 'exportReport' });

  // 1. Validação.
  const parsed = exportReportSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const { reportType, filters, format, acknowledgePII } = parsed.data;

  // 2. AuthN + RBAC por reportType (REL42-MN-03 — nega ⇒ sem dado, sem arquivo).
  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  let moderationGrants: DelegatedGrant[] = [];
  if (reportType === 'moderation_queue') {
    moderationGrants = await prisma.delegatedPermission.findMany({
      where: {
        personId: person.id,
        permission: { in: [...MODERATION_PERMISSIONS] },
        revokedAt: null,
      },
      select: { permission: true, scopeArea: true, revokedAt: true },
      take: 50,
    });
  }

  if (!isReportTypeAuthorized(reportType, person, moderationGrants)) {
    return fail('FORBIDDEN', 'Você não tem permissão para exportar este relatório.');
  }

  // 3. Ciência de responsabilidade LGPD (P-008/REL42-MN-06) — decidido ANTES
  // de rodar a query: hoje só `social` visto por AS/BOARD carrega PII (a
  // versão stripped do coordenador nunca tem dado sensível — REL42-MN-05).
  const containsPII = reportType === 'social' && canViewSocialReports(person.roles);
  if (containsPII && !acknowledgePII) {
    return fail(
      'VALIDATION',
      'É necessário confirmar a ciência de responsabilidade LGPD para exportar dados pessoais.',
    );
  }

  // 4. Query + montagem do arquivo.
  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  const built = await buildReportRows(reportType, filters, { roles: person.roles, id: person.id, ip, userAgent });
  if (!built) {
    // Defesa em profundidade: só ocorre para `social` se nem canSocial nem
    // canOps autorizarem — já barrado no passo 2, `viewSocialReport` repete
    // a guarda (T10).
    return fail('FORBIDDEN', 'Você não tem permissão para exportar este relatório.');
  }

  const exportedAt = new Date();
  const watermark = containsPII ? composeWatermark(person.fullName, exportedAt) : undefined;
  const title = REPORT_TITLES[reportType];
  const filenameStamp = formatSaoPaulo(exportedAt, 'yyyyMMdd-HHmm');

  let content: string;
  let mimeType: string;
  let filename: string;

  if (format === 'CSV') {
    content = toCsv(built.rows, built.columns, watermark ? { watermark } : {});
    mimeType = 'text/csv; charset=utf-8';
    filename = `${reportType}-${filenameStamp}.csv`;
  } else {
    const buffer = await renderToBuffer(
      <ReportPdfDocument title={title} columns={built.columns} rows={built.rows} watermark={watermark} />,
    );
    content = buffer.toString('base64');
    mimeType = 'application/pdf';
    filename = `${reportType}-${filenameStamp}.pdf`;
  }

  // 5. Auditoria (REL42-MN-07) — falha aqui reverte o export inteiro
  // (`withAudit` roda numa transação; sem `throw`, o retorno nunca sai daqui).
  try {
    const audited = await withAudit(
      AuditEvent.REPORT_EXPORTED,
      async (_tx, audit) => {
        audit.entityType = 'report';
        audit.entityId = null;
        audit.after = {
          reportType,
          format,
          filters,
          containsPII,
          rowCount: built.rows.length,
        };
        const payload: ExportPayload = { format, filename, mimeType, content };
        return payload;
      },
      { actorPersonId: person.id, ip, userAgent, context: { route: '/relatorios' } },
    );

    return ok(audited);
  } catch (err) {
    log.error({ err, reportType, format }, 'reporting:export_report:failed');
    return fail('INTERNAL', 'Erro interno ao exportar o relatório. Tente novamente mais tarde.');
  }
}
