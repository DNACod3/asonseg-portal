import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import { JobForm, listApprovedJobAreas } from '@/modules/jobs';
import { prisma } from '@/shared/lib/prisma';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

/**
 * Publicar vaga (USP-020 / #165). Só uma Pessoa responsável ATIVO da Empresa pode
 * acessar (P-006); caso contrário, 404 (não revela a existência da Empresa). Carrega
 * as áreas aprovadas e renderiza o formulário (rascunho + enviar para moderação).
 */
export default async function PublicarVagaPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const person = await requireActivePerson();

  // Gate P-006 na borda: responsável ATIVO da Empresa.
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

  // Leituras independentes após o gate — uma só ida ao banco (round-trips em paralelo).
  const [company, jobAreas] = await Promise.all([
    prisma.company.findUnique({
      where: { id: empresaId },
      select: { nomeFantasia: true },
    }),
    listApprovedJobAreas(),
  ]);
  if (!company) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Publicar vaga</h1>
        <p className="mt-1 text-sm text-gray-600">
          Em nome de <span className="font-medium">{company.nomeFantasia}</span>. Preencha os dados
          e envie para moderação — a vaga ficará visível aos candidatos após a aprovação. Você
          também pode salvar como rascunho.
        </p>
      </header>

      <JobForm companyId={empresaId} jobAreas={jobAreas} />
    </main>
  );
}
