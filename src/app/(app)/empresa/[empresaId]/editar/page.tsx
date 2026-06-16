import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import { EditCompanyForm } from '@/modules/companies';
import { prisma } from '@/shared/lib/prisma';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

/**
 * Edição de dados de uma Empresa (USP-015). Só um responsável ATIVO da Empresa
 * acessa — qualquer outra Pessoa recebe 404 (a rota não revela sua existência /
 * defesa em profundidade, P-004). A Server Action `editarEmpresa` reconfirma a
 * permissão. Carrega os dados atuais para pré-preencher o formulário.
 */
export default async function EditarEmpresaPage({
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

  const empresa = await prisma.company.findUnique({
    where: { id: empresaId },
    select: {
      id: true,
      cnpj: true,
      type: true,
      razaoSocial: true,
      nomeFantasia: true,
      setor: true,
      descricao: true,
      endereco: true,
      isVerified: true,
    },
  });
  if (!empresa) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Editar dados da empresa</h1>
        <p className="mt-1 text-sm text-gray-600">
          Mantenha os dados cadastrais atualizados. Alterar CNPJ, razão social ou nome fantasia
          exigirá nova verificação manual na próxima vaga publicada.
        </p>
      </header>

      <EditCompanyForm empresa={empresa} />
    </main>
  );
}
