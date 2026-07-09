import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import { ServiceForm, listServiceCategories } from '@/modules/services';
import { listActiveRegions } from '@/modules/jobs';
import { prisma } from '@/shared/lib/prisma';
import { FormCard, FormHeader, StepIcon } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

// SVG de mãos/ferramenta de serviço (mesma família de ícones do protótipo — stroke, viewBox 24x24).
const toolIcon = (
  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26"
    />
  </svg>
);

/**
 * Publicar serviço (USP-029 / T029-8). Só uma Pessoa com papel `PROVIDER` ativo
 * pode acessar — sem o papel, 404 (não revela a existência da rota, mesmo padrão
 * de `empresa/[empresaId]/vagas/nova`). Carrega as Empresas que a Pessoa
 * representa (AC-029-1 — seletor PF/Empresa), as categorias aprovadas e as
 * regiões ativas, e renderiza o formulário (rascunho + enviar para moderação).
 */
export default async function PublicarServicoPage() {
  const person = await requireActivePerson();

  if (!person.roles.includes('PROVIDER')) {
    notFound();
  }

  // Leituras independentes — uma só ida ao banco (round-trips em paralelo).
  const [companyGrants, categories, regions] = await Promise.all([
    prisma.personCompanyGrant.findMany({
      where: {
        personId: person.id,
        grantType: 'RESPONSIBLE',
        status: 'ACTIVE',
        revokedAt: null,
      },
      select: { company: { select: { id: true, nomeFantasia: true } } },
      take: 50,
    }),
    listServiceCategories(),
    listActiveRegions(),
  ]);
  const companies = companyGrants.map((g) => g.company);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <StepIcon variant="orange">{toolIcon}</StepIcon>
      <FormHeader
        title="Publicar serviço"
        description="Preencha os dados e envie para moderação — o serviço ficará visível na busca após a aprovação. Você também pode salvar como rascunho."
      />

      <FormCard>
        <ServiceForm companies={companies} categories={categories} regions={regions} />
      </FormCard>
    </main>
  );
}
