import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import { JobEditForm, listApprovedJobAreas, listActiveRegions } from '@/modules/jobs';
import { formatDateOnly } from '@/shared/lib/time';
import { prisma } from '@/shared/lib/prisma';
import { Card, FormCard, FormHeader } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

/**
 * Edição de vaga (USP-023 / T9 / E-001 / AC-023-1; USP-054 / EMP-2 / A-1). Mesma
 * guarda de `/vagas` e `/vagas/nova` (P-005/D-005): responsável ATIVO da Empresa,
 * senão `notFound()`. Roteia o formulário por status:
 *  - `ACTIVE` → `JobEditForm mode="active-edit"` (inalterado — `editJob`→`submitJobForModeration`).
 *  - `DRAFT`/`AWAITING_ADJUSTMENTS` → `JobEditForm mode="draft-edit"` (`updateJobDraft`,
 *    sem transição — USP054-03).
 *  - Demais status (terminal/em fila) → `Card` "não editável" (evita um submit
 *    fadado a `CONFLICT`).
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
        validUntil: true,
        status: true,
      },
    }),
    listApprovedJobAreas(),
    listActiveRegions(),
  ]);
  if (!job) {
    notFound();
  }

  const isActiveEdit = job.status === 'ACTIVE';
  // USP-054/EMP-2: DRAFT/AWAITING_ADJUSTMENTS editam sem transicionar (draft-edit);
  // demais status (terminal/em fila) não têm fluxo de edição por esta rota.
  const isDraftEdit = job.status === 'DRAFT' || job.status === 'AWAITING_ADJUSTMENTS';

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <FormHeader
        title="Editar vaga"
        description={
          isActiveEdit
            ? 'A vaga volta a rascunho e passa por nova moderação antes de reaparecer.'
            : 'Salve as alterações; envie ou reenvie para moderação quando estiver pronta.'
        }
      />

      {!isActiveEdit && !isDraftEdit ? (
        <Card>
          <p className="text-sm text-fg-muted">
            Esta vaga não pode ser editada por este fluxo no status atual. Só vagas ativas, em
            rascunho ou aguardando ajustes podem ser editadas.
          </p>
        </Card>
      ) : (
        <FormCard>
          <JobEditForm
            jobId={jobId}
            jobAreas={jobAreas}
            regions={regions}
            mode={isActiveEdit ? 'active-edit' : 'draft-edit'}
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
              // MOD-5: yyyy-MM-dd sem deslocamento de fuso (mesmo formatDateOnly de T3) —
              // um input[type=date] cru sobre `validUntil` reintroduziria o −1 dia.
              validUntil: job.validUntil ? formatDateOnly(job.validUntil, 'yyyy-MM-dd') : undefined,
            }}
          />
        </FormCard>
      )}
    </main>
  );
}
