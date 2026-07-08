import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import { requireServiceOwner, listServiceCategories, ServiceEditForm } from '@/modules/services';
import { listActiveRegions } from '@/modules/jobs';
import { prisma } from '@/shared/lib/prisma';
import { Card, FormCard, FormHeader } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

/**
 * Edição de um serviço `ACTIVE` (USP-032 / AC-032-1). Gate de ownership
 * (`requireServiceOwner` — autor OU responsável ativo da Empresa, SVC032-MN-02):
 * sem posse, `notFound()` (não revela a existência do serviço alheio). Só
 * serviços `ACTIVE` são editáveis por este fluxo (o guard efetivo é a
 * precondição de `editService`, `status='ACTIVE'`) — serviço em outro status
 * mostra uma mensagem em vez do formulário, evitando um submit fadado a
 * `CONFLICT`. Espelha `EditarVagaPage`.
 */
export default async function EditarServicoPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  const person = await requireActivePerson();

  const owner = await requireServiceOwner(person.id, serviceId);
  if (!owner.ok) {
    notFound();
  }

  const [service, categories, regions] = await Promise.all([
    prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        title: true,
        categoryId: true,
        description: true,
        priceMin: true,
        priceMax: true,
        priceUnit: true,
        regionId: true,
        availabilityDescription: true,
        status: true,
      },
    }),
    listServiceCategories(),
    listActiveRegions(),
  ]);
  if (!service) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <FormHeader
        title="Editar serviço"
        description="O serviço volta a rascunho e passa por nova moderação antes de reaparecer."
      />

      {service.status !== 'ACTIVE' ? (
        <Card>
          <p className="text-sm text-fg-muted">
            Este serviço não pode ser editado por este fluxo no status atual. Só serviços ativos
            podem ser editados.
          </p>
        </Card>
      ) : (
        <FormCard>
          <ServiceEditForm
            serviceId={serviceId}
            categories={categories}
            regions={regions}
            initialValues={{
              title: service.title,
              categoryId: service.categoryId ?? '',
              description: service.description ?? '',
              priceMin: service.priceMin?.toString() ?? '',
              priceMax: service.priceMax?.toString() ?? '',
              priceUnit: service.priceUnit ?? '',
              regionId: service.regionId ?? '',
              availabilityDescription: service.availabilityDescription ?? '',
            }}
          />
        </FormCard>
      )}
    </main>
  );
}
