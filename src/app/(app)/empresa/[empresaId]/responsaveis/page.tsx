import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import { AddResponsibleForm, RemoveResponsibleDialog, listActiveResponsibles } from '@/modules/companies';
import { FormHeader } from '@/shared/ui';
import { prisma } from '@/shared/lib/prisma';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

/**
 * Gestão de responsáveis de uma Empresa (USP-013). Só um responsável ATIVO da
 * Empresa acessa — qualquer outra Pessoa recebe 404 (a rota não revela sua
 * existência / L-004). A Server Action `adicionarResponsavel` reconfirma a
 * permissão (defesa em profundidade / P-005).
 */
export default async function ResponsaveisPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const person = await requireActivePerson();

  const grant = await prisma.personCompanyGrant.findFirst({
    where: {
      personId: person.id,
      companyId: empresaId,
      grantType: 'RESPONSIBLE',
      status: 'ACTIVE',
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!grant) {
    notFound();
  }

  const responsaveis = await listActiveResponsibles(empresaId, person.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-10">
      <FormHeader
        title="Responsáveis da empresa"
        description="Adicione outras pessoas como responsáveis desta Empresa. Cada convite fica pendente até que a pessoa convidada aceite o vínculo."
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Responsáveis ativos</h2>
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
          {responsaveis.map((r) => (
            <li key={r.grantId} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-sm text-gray-800">
                {r.nome}
                {r.isSelf && <span className="ml-2 text-xs text-gray-500">(você)</span>}
              </span>
              <RemoveResponsibleDialog grantId={r.grantId} nome={r.nome} isSelf={r.isSelf} />
            </li>
          ))}
        </ul>
      </section>

      <AddResponsibleForm empresaId={empresaId} />
    </main>
  );
}
