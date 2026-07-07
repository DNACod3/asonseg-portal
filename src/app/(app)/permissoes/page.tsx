import { notFound } from 'next/navigation';
import {
  requireActivePerson,
  isCoordinator,
  listDelegatedPermissions,
  listEligibleVolunteers,
  DelegatedPermissionsManager,
} from '@/modules/identity';
import { FormHeader } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

/**
 * Gestão de permissões delegadas a voluntários (USP-008).
 * Restrita a coordenadores — quem não tem o papel recebe 404.
 *
 * Refactor da Fase 1 (AD-014): restilizado com `FormHeader` e tokens — o gate
 * `isCoordinator -> notFound()`, `dynamic` e as queries preservados verbatim.
 */
export default async function PermissoesPage() {
  const viewer = await requireActivePerson();
  if (!isCoordinator(viewer)) {
    notFound();
  }

  const [volunteers, existing] = await Promise.all([
    listEligibleVolunteers(),
    listDelegatedPermissions(),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <FormHeader
        title="Permissões delegadas"
        description="Conceda ou revogue permissões administrativas a voluntários da sua área sem promovê-los a coordenador."
      />

      <DelegatedPermissionsManager volunteers={volunteers} existing={existing} />
    </main>
  );
}
