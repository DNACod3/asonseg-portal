import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import { listCompanyJobs, viewCompanyJobRow, CompanyJobList, requireActiveResponsible } from '@/modules/jobs';
import { prisma } from '@/shared/lib/prisma';
import { FormHeader } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

/**
 * Painel de gestão de vagas da Empresa (USP-023 / T8 / G7). Só a Pessoa
 * responsável ATIVA da Empresa acessa (P-005/D-005); caso contrário, `notFound()`
 * (404 — não revela a existência da Empresa, mesmo padrão de `/vagas/nova`).
 * Lista todas as vagas da Empresa (todos os status) com ações contextuais.
 */
export default async function GestaoVagasPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const person = await requireActivePerson();

  // Gate P-005 na borda: responsável ATIVO da Empresa. Reusa o mesmo helper das
  // actions de ciclo de vida (USP-023/T2) — um único ponto de verdade da autorização.
  if (!(await requireActiveResponsible(person.id, empresaId))) {
    notFound();
  }

  const company = await prisma.company.findUnique({
    where: { id: empresaId },
    select: { nomeFantasia: true },
  });
  if (!company) {
    notFound();
  }

  const rawRows = await listCompanyJobs(empresaId);
  const rows = rawRows.map(viewCompanyJobRow);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <FormHeader title="Minhas vagas" description={`Gestão das vagas de ${company.nomeFantasia}.`} />
      <CompanyJobList empresaId={empresaId} rows={rows} />
    </main>
  );
}
