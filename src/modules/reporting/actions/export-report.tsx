'use server';

import { headers } from 'next/headers';
import { renderToBuffer } from '@react-pdf/renderer';
import { AuditEvent, withAudit } from '@/modules/audit';
import { getCurrentPerson, type CurrentPerson, type DelegatedGrant } from '@/modules/identity';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { formatSaoPaulo } from '@/shared/lib/time';
import { prisma } from '@/shared/lib/prisma';
import {
  canViewModerationQueueReport,
  canViewOperationalReports,
  canViewSocialReports,
} from '../domain/report-access';
import { composeWatermark, toCsv, type CsvColumn } from '../domain/csv';
import { reportJobs } from '../queries/report-jobs';
import { reportApplications } from '../queries/report-applications';
import { reportServices } from '../queries/report-services';
import { reportReferrals } from '../queries/report-referrals';
import { reportModerationQueue } from '../queries/report-moderation-queue';
import { viewSocialReport } from '../views/social-report.view';
import { ReportPdfDocument } from '../components/report-pdf';
import { exportReportSchema, type ExportReportInput, type ReportType } from '../schemas/export-report';
import type { ReportFiltersInput } from '../schemas/report-filters';

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

const REPORT_TITLES: Record<ReportType, string> = {
  jobs: 'Relatório de vagas (MP4)',
  applications: 'Relatório de candidaturas (MP6)',
  services: 'Relatório de serviços e manifestações (MP5/MP7)',
  referrals: 'Relatório de encaminhamentos (MP8/MP9)',
  moderation_queue: 'Relatório de fila de moderação (MP10/MP3)',
  social: 'Relatório social por região',
};

const MODERATION_PERMISSIONS = ['MODERATE_JOB', 'MODERATE_CV', 'MODERATE_SERVICE'] as const;

interface BuiltReport {
  columns: CsvColumn<Record<string, unknown>>[];
  rows: Record<string, unknown>[];
}

/** Passo 2 — RBAC por `reportType` (guards T1). */
function isAuthorized(
  reportType: ReportType,
  person: CurrentPerson,
  moderationGrants: readonly DelegatedGrant[],
): boolean {
  switch (reportType) {
    case 'jobs':
    case 'applications':
    case 'services':
    case 'referrals':
      return canViewOperationalReports(person.roles);
    case 'moderation_queue':
      return canViewModerationQueueReport(person, moderationGrants);
    case 'social':
      return canViewSocialReports(person.roles) || canViewOperationalReports(person.roles);
  }
}

/** Passo 4 — roda a query do `reportType` e projeta em `{columns, rows}` (formato flat, CSV/PDF). */
async function buildReport(
  reportType: ReportType,
  filters: ReportFiltersInput,
  viewer: { roles: readonly string[]; id: string; ip: string | null; userAgent: string | null },
): Promise<BuiltReport | null> {
  switch (reportType) {
    case 'jobs': {
      const rows = await reportJobs(filters);
      return {
        columns: [
          { key: 'status', label: 'Status' },
          { key: 'count', label: 'Quantidade' },
        ],
        rows: rows.map((r) => ({ status: r.status, count: r.count })),
      };
    }
    case 'applications': {
      const rows = await reportApplications(filters);
      return {
        columns: [{ key: 'total', label: 'Total de candidaturas (MP6)' }],
        rows: rows.map((r) => ({ total: r.total })),
      };
    }
    case 'services': {
      const report = await reportServices(filters);
      const rows: Record<string, unknown>[] = report.byStatusAndCategory.map((r) => ({
        status: r.status,
        categoryId: r.categoryId,
        count: r.count,
      }));
      rows.push({ status: 'MANIFESTACOES_INTERESSE', categoryId: null, count: report.interestsCount });
      return {
        columns: [
          { key: 'status', label: 'Status' },
          { key: 'categoryId', label: 'Categoria' },
          { key: 'count', label: 'Quantidade (MP5) / manifestações (MP7)' },
        ],
        rows,
      };
    }
    case 'referrals': {
      const report = await reportReferrals(filters);
      return {
        columns: [
          { key: 'metric', label: 'Métrica' },
          { key: 'value', label: 'Valor' },
        ],
        rows: [
          { metric: 'Encaminhamentos criados (MP8)', value: report.totalCreated },
          { metric: 'Com resultado registrado', value: report.outcome.withResult },
          { metric: 'Sem resultado registrado', value: report.outcome.withoutResult },
          { metric: 'Taxa de sucesso (MP9)', value: report.outcome.successRate },
          { metric: 'Taxa sem resultado registrado', value: report.outcome.noResultRate },
        ],
      };
    }
    case 'moderation_queue': {
      const report = await reportModerationQueue(filters);
      return {
        columns: [
          { key: 'metric', label: 'Métrica' },
          { key: 'value', label: 'Valor' },
        ],
        rows: [
          { metric: 'Fila — vagas (JOB)', value: report.queueByKind.JOB },
          { metric: 'Fila — CVs', value: report.queueByKind.CV },
          { metric: 'Fila — serviços', value: report.queueByKind.SERVICE },
          { metric: 'Fila — perfis de candidato', value: report.queueByKind.CANDIDATE_PROFILE },
          { metric: 'Tempo médio de moderação em horas (MP10)', value: report.avgModerationHours },
          { metric: 'Prestadores ativos (MP3)', value: report.activeProviders },
        ],
      };
    }
    case 'social': {
      const social = await viewSocialReport(filters, {
        roles: viewer.roles,
        personId: viewer.id,
        ip: viewer.ip,
        userAgent: viewer.userAgent,
      });
      if (!social) return null;

      if (social.scope === 'stripped') {
        return {
          columns: [
            { key: 'regionName', label: 'Região' },
            { key: 'total', label: 'Total' },
          ],
          rows: social.regions.map((r) => ({ regionName: r.regionName ?? 'Sem região', total: r.total })),
        };
      }

      const rows: Record<string, unknown>[] = [];
      for (const entry of social.sensitive ?? []) {
        const regionName = entry.regionName ?? 'Sem região';
        for (const [bracket, count] of Object.entries(entry.byIncomeBracket)) {
          rows.push({ regionName, dimensao: 'Faixa de renda', categoria: bracket, quantidade: count });
        }
        for (const [situation, count] of Object.entries(entry.byHousingSituation)) {
          rows.push({ regionName, dimensao: 'Situação de moradia', categoria: situation, quantidade: count });
        }
        rows.push({
          regionName,
          dimensao: 'Com benefício social declarado',
          categoria: '—',
          quantidade: entry.withSocialBenefit,
        });
        rows.push({
          regionName,
          dimensao: 'Com composição familiar declarada',
          categoria: '—',
          quantidade: entry.withFamilyCompositionDeclared,
        });
      }
      return {
        columns: [
          { key: 'regionName', label: 'Região' },
          { key: 'dimensao', label: 'Dimensão' },
          { key: 'categoria', label: 'Categoria' },
          { key: 'quantidade', label: 'Quantidade' },
        ],
        rows,
      };
    }
  }
}

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

  if (!isAuthorized(reportType, person, moderationGrants)) {
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

  const built = await buildReport(reportType, filters, { roles: person.roles, id: person.id, ip, userAgent });
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
