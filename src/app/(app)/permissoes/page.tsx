import { notFound } from 'next/navigation';
import {
  requireActivePerson,
  isCoordinator,
  listDelegatedPermissions,
  listEligibleVolunteers,
  DelegatedPermissionsManager,
} from '@/modules/identity';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

/**
 * Gestão de permissões delegadas a voluntários (USP-008).
 * Restrita a coordenadores — quem não tem o papel recebe 404.
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
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900">Permissões delegadas</h1>
        <p className="text-sm text-gray-600">
          Conceda ou revogue permissões administrativas a voluntários da sua área sem
          promovê-los a coordenador.
        </p>
      </header>

      <DelegatedPermissionsManager volunteers={volunteers} existing={existing} />
    </main>
  );
}
