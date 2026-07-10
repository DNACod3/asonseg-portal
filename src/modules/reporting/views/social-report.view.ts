import { AuditEvent, recordAuditEvent } from '@/modules/audit';
import { prisma } from '@/shared/lib/prisma';
import { canViewOperationalReports, canViewSocialReports } from '../domain/report-access';

/**
 * R6 — relatório social por região (REL42-MN-05 / ADR-0022 / P-007). View
 * Model com 2 barreiras de privacidade (espelha USP-039/AD-022 —
 * `viewPersonForSocialAssistant`/`getSocioeconomicRecord`):
 *  - **B1** — SELECT condicional ao papel: os campos sensíveis da ficha
 *    (`incomeBracket`/`housingSituation`/`socialBenefit`/`familyComposition`)
 *    só são SELECIONADOS do banco quando {@link canViewSocialReports} (AS/BOARD)
 *    autoriza — para coordenador, a query sensível **nunca roda**.
 *  - **B2** — strip estrutural no tipo: `SocialReport.sensitive` só existe
 *    (`!== null`) quando `scope === 'full'`; a versão `stripped` do
 *    coordenador não tem onde carregar o dado sensível, mesmo que B1 falhasse.
 *
 * SPEC_DEVIATION: design.md §1/§7 nomeia a assinatura como
 * `viewSocialReport(filters, viewer:{roles})`. O relatório FULL exige
 * audit-on-read (`SENSITIVE_FIELD_VIEWED` — design.md §7, E-003) e um evento
 * de auditoria precisa de um ator atribuível — `{roles}` sozinho não basta
 * (ao contrário de `viewPersonForSocialAssistant`, que delega a auditoria a
 * `getSocioeconomicRecord`, que resolve o ator via `getCurrentPerson()`
 * internamente; aqui não há "1 pessoa" para delegar — é um agregado). Reason:
 * estendo `viewer` com `personId` (+ `ip`/`userAgent` opcionais, vindos dos
 * headers da request) para que a própria leitura sensível se audite, sem
 * depender de todo chamador lembrar de auditar — mesma filosofia de
 * `getSocioeconomicRecord`.
 */

export interface SocialReportFilters {
  regionId?: string;
}

export interface SocialReportViewer {
  roles: readonly string[];
  personId: string;
  ip?: string | null;
  userAgent?: string | null;
}

/** Linha SEMPRE presente (stripped e full) — só a contagem por região, sem dado sensível. */
export interface SocialReportRegionRow {
  regionId: string | null;
  regionName: string | null;
  total: number;
}

/** Quebra sensível por região — só existe na versão full (AS/BOARD). Agregado, nunca nome/CPF. */
export interface SocialReportSensitiveBreakdown {
  regionId: string | null;
  regionName: string | null;
  byIncomeBracket: Record<string, number>;
  byHousingSituation: Record<string, number>;
  withSocialBenefit: number;
  withFamilyCompositionDeclared: number;
}

export interface SocialReport {
  scope: 'full' | 'stripped';
  regions: SocialReportRegionRow[];
  /** `null` quando `scope === 'stripped'` (REL42-MN-05 — barreira B2). */
  sensitive: SocialReportSensitiveBreakdown[] | null;
}

interface RegionRef {
  regionId: string | null;
  regionName: string | null;
}

/** Resolve a região de uma Pessoa via `candidateProfile` (prioridade) ou `providerProfile`. */
function resolvePersonRegion(person: {
  candidateProfile: { regionId: string | null; region: { name: string } | null } | null;
  providerProfile: { regionId: string | null; region: { name: string } | null } | null;
}): RegionRef {
  if (person.candidateProfile?.regionId) {
    return { regionId: person.candidateProfile.regionId, regionName: person.candidateProfile.region?.name ?? null };
  }
  if (person.providerProfile?.regionId) {
    return { regionId: person.providerProfile.regionId, regionName: person.providerProfile.region?.name ?? null };
  }
  return { regionId: null, regionName: null };
}

function buildWhere(filters: SocialReportFilters) {
  if (!filters.regionId) return undefined;
  return {
    person: {
      OR: [
        { candidateProfile: { regionId: filters.regionId } },
        { providerProfile: { regionId: filters.regionId } },
      ],
    },
  };
}

/** SELECT comum (B1 — NUNCA inclui campo sensível): personId + o suficiente para resolver a região. */
const REGION_SELECT = {
  personId: true,
  person: {
    select: {
      candidateProfile: { select: { regionId: true, region: { select: { name: true } } } },
      providerProfile: { select: { regionId: true, region: { select: { name: true } } } },
    },
  },
} as const;

/**
 * Agrega `rows` (qualquer shape que carregue `person` no formato de
 * `REGION_SELECT.person`) em totais por região. Reusada por AMBOS os ramos
 * (`stripped` a partir de `baseRows`, `full` a partir de `sensitiveRows` —
 * que já inclui o mesmo `person: REGION_SELECT.person`) para não exigir uma
 * 2ª varredura de `socioeconomicRecord` só para os totais regionais no ramo
 * `full`.
 */
function deriveRegionTotals(
  rows: readonly { person: Parameters<typeof resolvePersonRegion>[0] }[],
): SocialReportRegionRow[] {
  const regionTotals = new Map<string, SocialReportRegionRow>();
  for (const row of rows) {
    const { regionId, regionName } = resolvePersonRegion(row.person);
    const key = regionId ?? '__no_region__';
    const existing = regionTotals.get(key);
    if (existing) {
      existing.total += 1;
    } else {
      regionTotals.set(key, { regionId, regionName, total: 1 });
    }
  }
  return [...regionTotals.values()];
}

/**
 * Relatório social por região (REL42-MN-05). `viewer` sem
 * {@link canViewSocialReports} E sem {@link canViewOperationalReports} ⇒
 * `null` — nem a versão stripped é servida a quem não tem acesso a NENHUM
 * relatório operacional.
 */
export async function viewSocialReport(
  filters: SocialReportFilters,
  viewer: SocialReportViewer,
): Promise<SocialReport | null> {
  const canSocial = canViewSocialReports(viewer.roles);
  const canOps = canViewOperationalReports(viewer.roles);
  if (!canSocial && !canOps) return null;

  const where = buildWhere(filters);

  if (!canSocial) {
    // Coordenador (canOps=true, canSocial=false): stripped — B1: SELECT que
    // NUNCA carrega campo sensível; roda a ÚNICA query deste ramo. `sensitive`
    // fica estruturalmente `null` (B2).
    const baseRows = await prisma.socioeconomicRecord.findMany({
      where,
      select: REGION_SELECT,
      take: 5000,
    });
    const regions = deriveRegionTotals(baseRows);
    return { scope: 'stripped', regions, sensitive: null };
  }

  // B1 (full): a ÚNICA query deste módulo que seleciona campo sensível — só
  // roda sob `canViewSocialReports` (AS/BOARD). Também carrega `person:
  // REGION_SELECT.person`, então os totais regionais (`regions`) são
  // derivados dela abaixo em vez de uma 2ª varredura idêntica de
  // `socioeconomicRecord` (perf — mesma `where`/`take` do ramo antigo).
  const sensitiveRows = await prisma.socioeconomicRecord.findMany({
    where,
    select: {
      incomeBracket: true,
      housingSituation: true,
      socialBenefit: true,
      familyComposition: true,
      person: REGION_SELECT.person,
    },
    take: 5000,
  });

  const regions = deriveRegionTotals(sensitiveRows);

  const sensitiveByRegion = new Map<string, SocialReportSensitiveBreakdown>();
  for (const row of sensitiveRows) {
    const { regionId, regionName } = resolvePersonRegion(row.person);
    const key = regionId ?? '__no_region__';
    const entry =
      sensitiveByRegion.get(key) ??
      ({
        regionId,
        regionName,
        byIncomeBracket: {},
        byHousingSituation: {},
        withSocialBenefit: 0,
        withFamilyCompositionDeclared: 0,
      } satisfies SocialReportSensitiveBreakdown);

    if (row.incomeBracket) {
      entry.byIncomeBracket[row.incomeBracket] = (entry.byIncomeBracket[row.incomeBracket] ?? 0) + 1;
    }
    if (row.housingSituation) {
      entry.byHousingSituation[row.housingSituation] = (entry.byHousingSituation[row.housingSituation] ?? 0) + 1;
    }
    if (row.socialBenefit) entry.withSocialBenefit += 1;
    if (row.familyComposition) entry.withFamilyCompositionDeclared += 1;

    sensitiveByRegion.set(key, entry);
  }
  const sensitive = [...sensitiveByRegion.values()];

  // Audit-on-read (E-003/design.md §7) — 1 evento por leitura do relatório
  // FULL (não por Pessoa — é um agregado, não uma ficha individual).
  await prisma.$transaction(async (tx) => {
    await recordAuditEvent(
      tx,
      AuditEvent.SENSITIVE_FIELD_VIEWED,
      {
        entityType: 'social_report',
        entityId: null,
        context: {
          via: 'social_report',
          regionsCount: sensitive.length,
          viewedFields: ['incomeBracket', 'housingSituation', 'socialBenefit', 'familyComposition'],
        },
      },
      { actorPersonId: viewer.personId, ip: viewer.ip ?? null, userAgent: viewer.userAgent ?? null },
    );
  });

  return { scope: 'full', regions, sensitive };
}
