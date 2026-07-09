import Link from 'next/link';
import { requireActivePerson } from '@/modules/identity';
import { prisma } from '@/shared/lib/prisma';
import { REPORT_TYPES, REPORT_TITLES, isReportTypeAuthorized, type ReportType } from '@/modules/reporting';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

const MODERATION_PERMISSIONS = ['MODERATE_JOB', 'MODERATE_CV', 'MODERATE_SERVICE'] as const;

/**
 * Índice de relatórios (USP-042 / T12 — E-001). Lista só os relatórios que o
 * viewer ATUAL pode acessar (mesmo guard de `[tipo]/page.tsx` e
 * `exportReport`, T1/T11) — quem não tem acesso a nenhum simplesmente vê uma
 * lista vazia, sem revelar quais relatórios existem no sistema.
 */
export default async function RelatoriosIndexPage() {
  const person = await requireActivePerson();

  const moderationGrants = await prisma.delegatedPermission.findMany({
    where: { personId: person.id, permission: { in: [...MODERATION_PERMISSIONS] }, revokedAt: null },
    select: { permission: true, scopeArea: true, revokedAt: true },
    take: 50,
  });

  const accessible = REPORT_TYPES.filter((tipo: ReportType) =>
    isReportTypeAuthorized(tipo, person, moderationGrants),
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="font-heading text-2xl font-bold text-fg">Relatórios</h1>
        <p className="text-sm text-fg-muted">
          Relatórios operacionais filtráveis por período, exportáveis em CSV ou PDF.
        </p>
      </header>

      {accessible.length === 0 ? (
        <p className="text-sm text-fg-muted">Nenhum relatório disponível para o seu papel.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {accessible.map((tipo) => (
            <li key={tipo}>
              <Link
                href={`/relatorios/${tipo}`}
                className="block rounded-md border border-border bg-background px-4 py-3 text-sm font-medium text-fg hover:border-primary hover:text-primary"
              >
                {REPORT_TITLES[tipo]}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
