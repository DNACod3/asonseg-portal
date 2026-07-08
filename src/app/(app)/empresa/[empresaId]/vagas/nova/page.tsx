import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import { JobForm, listApprovedJobAreas, listActiveRegions } from '@/modules/jobs';
import { prisma } from '@/shared/lib/prisma';
import { FormCard, FormHeader, StepIcon } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

// SVG de maleta/vaga (mesma família de ícones do protótipo — stroke, viewBox 24x24).
const briefcaseIcon = (
  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z"
    />
  </svg>
);

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
  const [company, jobAreas, regions] = await Promise.all([
    prisma.company.findUnique({
      where: { id: empresaId },
      select: { nomeFantasia: true },
    }),
    listApprovedJobAreas(),
    listActiveRegions(),
  ]);
  if (!company) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <StepIcon variant="blue">{briefcaseIcon}</StepIcon>
      <FormHeader
        title="Publicar vaga"
        description={`Em nome de ${company.nomeFantasia}. Preencha os dados e envie para moderação — a vaga ficará visível aos candidatos após a aprovação. Você também pode salvar como rascunho.`}
      />

      <FormCard>
        <JobForm companyId={empresaId} jobAreas={jobAreas} regions={regions} />
      </FormCard>
    </main>
  );
}
