import { ActivateRoleForm, buildActivatableOptions, requireActivePerson } from '@/modules/identity';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

/**
 * "Ativar papel adicional" (USP-006). Lista os papéis públicos que a Pessoa
 * autenticada ainda não possui, exibindo apenas os campos faltantes de cada um
 * (E-001) e o termo específico da finalidade (P-004). Privacidade: usa o `id` da
 * própria Pessoa — a ativação opera exclusivamente sobre a sessão (P-002).
 */
export default async function PapeisPage() {
  const person = await requireActivePerson();

  // `getCurrentPerson` (via requireActivePerson) já trouxe papéis ativos + perfil:
  // sem segunda leitura da Pessoa. Os termos são carregados em paralelo no helper.
  const activeRoles = new Set(person.roles);
  const snapshot = { phone: person.phone, fullAddress: person.fullAddress };
  const options = await buildActivatableOptions(snapshot, activeRoles);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Ativar novo papel</h1>
        <p className="mt-1 text-sm text-gray-600">
          Você pode usar o portal com mais de um papel usando o mesmo login. Ative um papel novo
          preenchendo apenas os dados que ainda faltam e aceitando o termo da finalidade
          correspondente — a ativação é imediata, sem etapa de aprovação.
        </p>
      </header>

      <ActivateRoleForm options={options} />
    </main>
  );
}
