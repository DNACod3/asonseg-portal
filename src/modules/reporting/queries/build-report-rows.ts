import type { CsvColumn } from '../domain/csv';
import { reportJobs } from './report-jobs';
import { reportApplications } from './report-applications';
import { reportServices } from './report-services';
import { reportReferrals } from './report-referrals';
import { reportModerationQueue } from './report-moderation-queue';
import { viewSocialReport } from '../views/social-report.view';
import type { ReportType } from '../schemas/export-report';
import type { ReportFiltersInput } from '../schemas/report-filters';

export interface BuiltReport {
  columns: CsvColumn<Record<string, unknown>>[];
  rows: Record<string, unknown>[];
  /**
   * Reforço de MN-04 (só presente para `reportType === 'referrals'`) —
   * consumido pela UI (`ReportView`) para exibir `successRate` sempre ao
   * lado de `noResultRate`, além de já estarem juntas nas `rows` acima.
   */
  outcomeRates?: { successRate: number | null; noResultRate: number | null };
}

/**
 * Roda a query do `reportType` e projeta o resultado em `{columns, rows}`
 * (formato flat, reusado pelo CSV/PDF do export — T11 — e pela tabela da UI
 * — T12). Único ponto que sabe transformar cada relatório num formato
 * tabular: mudar a projeção de um relatório muda export E tela juntos.
 *
 * `viewer` só é necessário para `reportType === 'social'` (audit-on-read de
 * `viewSocialReport`, T10). Retorna `null` apenas nesse caso, quando nem
 * `canViewSocialReports` nem `canViewOperationalReports` autorizam — defesa
 * em profundidade (o chamador já barrou via `isReportTypeAuthorized`).
 */
export async function buildReportRows(
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
        outcomeRates: { successRate: report.outcome.successRate, noResultRate: report.outcome.noResultRate },
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
