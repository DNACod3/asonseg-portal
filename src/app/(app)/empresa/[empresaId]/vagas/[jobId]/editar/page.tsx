import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import { JobEditForm, listApprovedJobAreas, listActiveRegions } from '@/modules/jobs';
import { prisma } from '@/shared/lib/prisma';
import { Card, FormCard, FormHeader } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

/**
 * Edição de uma vaga `ACTIVE` (USP-023 / T9 / E-001 / AC-023-1). Mesma guarda de
 * `/vagas` e `/vagas/nova` (P-005/D-005): responsável ATIVO da Empresa, senão
 * `notFound()`. Só vagas `ACTIVE` são editáveis por este fluxo (o guard efetivo
 * é a precondição de `editJob`, `status='ACTIVE'`) — vaga em outro status mostra
 * uma mensagem em vez do formulário, evitando um submit fadado a `CONFLICT`.
 */
export default async function EditarVagaPage({
  params,
}: {
  params: Promise<{ empresaId: string; jobId: string }>;
}) {
  const { empresaId, jobId } = await params;
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

  const [job, jobAreas, regions] = await Promise.all([
    prisma.job.findFirst({
      where: { id: jobId, companyId: empresaId },
      select: {
        title: true,
        areaId: true,
        description: true,
        requirements: true,
        workRegime: true,
        location: true,
        benefits: true,
        salary: true,
        contractType: true,
        regionId: true,
        educationLevelRequired: true,
        salaryMin: true,
        salaryMax: true,
        salaryVisible: true,
        status: true,
      },
    }),
    listApprovedJobAreas(),
    listActiveRegions(),
  ]);
  if (!job) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <FormHeader title="Editar vaga" description="A vaga volta a rascunho e passa por nova moderação antes de reaparecer." />

      {job.status !== 'ACTIVE' ? (
        <Card>
          <p className="text-sm text-fg-muted">
            Esta vaga não pode ser editada por este fluxo no status atual. Só vagas ativas podem
            ser editadas.
          </p>
        </Card>
      ) : (
        <FormCard>
          <JobEditForm
            jobId={jobId}
            jobAreas={jobAreas}
            regions={regions}
            initialValues={{
              title: job.title,
              areaId: job.areaId ?? '',
              description: job.description ?? '',
              requirements: job.requirements ?? '',
              workRegime: job.workRegime ?? '',
              location: job.location ?? '',
              benefits: job.benefits ?? '',
              salary: job.salary ?? '',
              contractType: job.contractType ?? '',
              regionId: job.regionId ?? '',
              educationLevelRequired: job.educationLevelRequired ?? '',
              salaryMin: job.salaryMin?.toString() ?? '',
              salaryMax: job.salaryMax?.toString() ?? '',
              salaryVisible: job.salaryVisible,
            }}
          />
        </FormCard>
      )}
    </main>
  );
}
