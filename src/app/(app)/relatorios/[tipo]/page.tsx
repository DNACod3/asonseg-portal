import { notFound } from 'next/navigation';
import { requireActivePerson, type DelegatedGrant } from '@/modules/identity';
import {
  REPORT_TYPES,
  REPORT_TITLES,
  canViewSocialReports,
  isReportTypeAuthorized,
  buildReportRows,
  getModerationGrants,
  ReportView,
  type ReportType,
} from '@/modules/reporting';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

/**
 * Página de um relatório operacional (USP-042 / T12 — E-001/E-004,
 * REL42-MN-02/03/05). Server Component `force-dynamic`: revalida a sessão
 * (`requireActivePerson`), aplica o guard do `reportType` (T1, via
 * {@link isReportTypeAuthorized} — o MESMO guard que `exportReport` usa,
 * T11, para as duas superfícies nunca divergirem), busca a projeção
 * `{columns, rows}` (T5..T10 via `buildReportRows`) e renderiza
 * `<ReportView/>`.
 *
 * `tipo` desconhecido OU viewer sem autorização ⇒ `notFound()` — a rota não
 * revela sequência de relatórios existentes a quem não tem acesso
 * (REL42-MN-02/03). Para `social`, `containsPII` espelha exatamente a
 * decisão de `exportReport` (`social` + `canViewSocialReports` ⇒ true) —
 * controla o checkbox de ciência LGPD na UI (REL42-MN-06 reforçado).
 */
export default async function RelatorioPage({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tipo } = await params;
  if (!isReportType(tipo)) {
    notFound();
  }

  const person = await requireActivePerson();

  let moderationGrants: DelegatedGrant[] = [];
  if (tipo === 'moderation_queue') {
    moderationGrants = await getModerationGrants(person.id);
  }

  if (!isReportTypeAuthorized(tipo, person, moderationGrants)) {
    notFound();
  }

  const sp = await searchParams;
  const filters = {
    from: typeof sp.from === 'string' && sp.from ? sp.from : undefined,
    to: typeof sp.to === 'string' && sp.to ? sp.to : undefined,
    status: typeof sp.status === 'string' && sp.status ? sp.status : undefined,
    categoryId: typeof sp.categoryId === 'string' && sp.categoryId ? sp.categoryId : undefined,
    regionId: typeof sp.regionId === 'string' && sp.regionId ? sp.regionId : undefined,
  };

  const built = await buildReportRows(tipo, filters, {
    roles: person.roles,
    id: person.id,
    ip: null,
    userAgent: null,
  });
  if (!built) {
    // Defesa em profundidade (`social` sem nenhum guard) — já barrado acima.
    notFound();
  }

  const containsPII = tipo === 'social' && canViewSocialReports(person.roles);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="font-heading text-2xl font-bold text-fg">{REPORT_TITLES[tipo]}</h1>
      </header>
      <ReportView
        reportType={tipo}
        title={REPORT_TITLES[tipo]}
        columns={built.columns}
        rows={built.rows}
        filters={filters}
        outcomeRates={built.outcomeRates}
        containsPII={containsPII}
      />
    </main>
  );
}
