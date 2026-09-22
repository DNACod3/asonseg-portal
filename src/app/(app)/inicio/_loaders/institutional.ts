import { formatInTimeZone } from 'date-fns-tz';
import { viewModerationQueue, countQueueByKind, type ModerationQueueItem } from '@/modules/moderation';
import { reportReferrals, countActivePersons, getHomeIndicators } from '@/modules/reporting';
import { listRecentReferrals, canRegisterReferralResult } from '@/modules/referrals';
import type { CurrentPerson } from '@/modules/identity';
import { APP_TIME_ZONE } from '@/shared/lib/time';
import { childLogger } from '@/shared/lib/logger';
import type { KpiItem } from '../_components/kpi-strip';
import type { QuickAction } from '../_components/quick-actions';

const log = childLogger({ module: 'inicio', loader: 'institutional' });

export interface InstitutionalQueueRow {
  contentKind: ModerationQueueItem['contentKind'];
  contentId: string;
  title: string;
  authorName: string | null;
  companyUnverified?: boolean;
  companyId?: string;
}

export interface InstitutionalReferralRow {
  id: string;
  jobTitle: string;
  companyName: string;
  referredPersonName: string;
  result: string | null;
  createdAt: Date;
}

export interface InstitutionalPanelData {
  /** `false` → fila somente leitura (D-001/PNL-MN-03): sem ação, sem "ver fila completa". */
  canModerate: boolean;
  /** `false` → sem "registrar resultado" nas linhas de encaminhamento (BOARD). */
  canRegisterReferralResult: boolean;
  kpis: KpiItem[];
  quickActions: QuickAction[];
  queue: InstitutionalQueueRow[];
  queueTotal: number;
  referrals: InstitutionalReferralRow[];
  referralsTotal: number;
}

function currentMonthWindow(): { from: string; to: string } {
  const to = formatInTimeZone(new Date(), APP_TIME_ZONE, 'yyyy-MM-dd');
  return { from: `${to.slice(0, 7)}-01`, to };
}

/**
 * Carrega o bloco institucional do painel `/inicio` (COORDINATOR/
 * SOCIAL_ASSISTANT/BOARD e voluntário delegado — USP-067 PNL-05/06/07).
 * `canModerate` vem do guard ao vivo `canAccessModerationQueue`, já
 * resolvido 1x em `page.tsx` (React `cache`) — decide ações/link da fila
 * (D-001 / PNL-MN-03), **uniformemente**, sem branch por papel (o próprio
 * D-001 amarra o read-only ao guard, não a um `if role === ...`).
 *
 * KPIs variam por papel — prioridade COORDINATOR > BOARD > SOCIAL_ASSISTANT
 * para papéis institucionais compostos (nenhum ADR resolve essa ordem
 * explicitamente; escolha conservadora: o papel com mais dado agregado
 * ganha). Voluntário puro com delegação (sem papel institucional) só vê a
 * fila — sem KPIs/card de encaminhamentos (A-17).
 */
export async function loadInstitutionalPanel(
  person: CurrentPerson,
  roles: readonly string[],
  canModerate: boolean,
): Promise<InstitutionalPanelData> {
  const isCoordinator = roles.includes('COORDINATOR');
  const isBoard = roles.includes('BOARD');
  const isSocialAssistant = roles.includes('SOCIAL_ASSISTANT');
  const needsReferrals = isCoordinator || isBoard || isSocialAssistant;

  const [queueItems, canRegisterResult, monthReport, recentReferrals, activePersons, homeIndicators] =
    await Promise.all([
      viewModerationQueue({ viewerPersonId: person.id }).catch((err) => {
        log.error({ err }, 'institutional:queue-failed');
        return [];
      }),
      canRegisterReferralResult(person).catch((err) => {
        log.error({ err }, 'institutional:register-result-guard-failed');
        return false;
      }),
      needsReferrals
        ? reportReferrals(currentMonthWindow()).catch((err) => {
            log.error({ err }, 'institutional:report-referrals-failed');
            return { totalCreated: 0, outcome: { withoutResult: 0 } };
          })
        : Promise.resolve({ totalCreated: 0, outcome: { withoutResult: 0 } }),
      needsReferrals
        ? listRecentReferrals().catch((err) => {
            log.error({ err }, 'institutional:recent-referrals-failed');
            return [];
          })
        : Promise.resolve([]),
      // BOARD counts entram aqui (mesmo padrão conditional-promise de
      // `needsReferrals` acima) em vez de um `Promise.all` sequencial
      // separado depois — evita 1 roundtrip extra por request BOARD
      // (PR 297 review). `getHomeIndicators` é dedupicado via `cache()`
      // com a chamada do loader CANDIDATE quando o papel é composto.
      isBoard
        ? countActivePersons().catch((err) => {
            log.error({ err }, 'institutional:active-persons-failed');
            return 0;
          })
        : Promise.resolve(0),
      isBoard
        ? getHomeIndicators().catch((err) => {
            log.error({ err }, 'institutional:home-indicators-failed');
            return { activeJobs: 0, activeCandidates: 0, verifiedCompanies: 0 };
          })
        : Promise.resolve({ activeJobs: 0, activeCandidates: 0, verifiedCompanies: 0 }),
    ]);

  const queueCounts = countQueueByKind(queueItems);
  const kpis: KpiItem[] = [{ label: 'Moderações pendentes', value: queueCounts.total, tone: 'cta' }];

  if (isCoordinator || !needsReferrals) {
    // COORDINATOR (ou voluntário delegado sem papel institucional próprio).
    kpis.push(
      { label: 'Vagas na fila', value: queueCounts.byKind.JOB ?? 0, tone: 'muted' },
      {
        label: 'Currículos na fila',
        value: (queueCounts.byKind.CV ?? 0) + (queueCounts.byKind.CANDIDATE_PROFILE ?? 0),
        tone: 'muted',
      },
    );
    if (isCoordinator) {
      kpis.push({ label: 'Encaminhamentos no mês', value: monthReport.totalCreated, tone: 'primary' });
    }
  } else if (isBoard) {
    kpis.push(
      { label: 'Encaminhamentos no mês', value: monthReport.totalCreated, tone: 'primary' },
      { label: 'Pessoas ativas', value: activePersons, tone: 'success' },
      { label: 'Empresas ativas', value: homeIndicators.verifiedCompanies, tone: 'muted' },
    );
  } else if (isSocialAssistant) {
    kpis.push(
      { label: 'Encaminhamentos no mês', value: monthReport.totalCreated, tone: 'primary' },
      { label: 'Aguardando resultado', value: monthReport.outcome.withoutResult, tone: 'muted' },
    );
  }

  const quickActions: QuickAction[] = canModerate
    ? [{ label: 'Ir para a fila de moderação', href: '/moderacao', variant: 'primary' }]
    : [];

  return {
    canModerate,
    canRegisterReferralResult: canRegisterResult,
    kpis,
    quickActions,
    queue: queueItems.slice(0, 5).map((item) => ({
      contentKind: item.contentKind,
      contentId: item.contentId,
      title: item.title,
      authorName: item.authorName,
      companyUnverified: item.companyUnverified,
      companyId: item.companyId,
    })),
    queueTotal: queueItems.length,
    referrals: needsReferrals
      ? recentReferrals.slice(0, 5).map((row) => ({
          id: row.id,
          jobTitle: row.jobTitle,
          companyName: row.companyName,
          referredPersonName: row.referredPersonName,
          result: row.result,
          createdAt: row.createdAt,
        }))
      : [],
    referralsTotal: needsReferrals ? recentReferrals.length : 0,
  };
}
