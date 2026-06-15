import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import { AddResponsibleForm } from '@/modules/companies';
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

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Responsáveis da empresa</h1>
        <p className="mt-1 text-sm text-gray-600">
          Adicione outras pessoas como responsáveis desta Empresa. Cada convite fica pendente até
          que a pessoa convidada aceite o vínculo.
        </p>
      </header>

      <AddResponsibleForm empresaId={empresaId} />
    </main>
  );
}
