import {
  ActivateRoleForm,
  missingProfileFields,
  PUBLIC_ROLES,
  ROLE_LABELS,
  ROLE_PURPOSE_MAP,
  requireActivePerson,
  type ActivatableRoleOption,
} from '@/modules/identity';
import { loadTerm, purposeMetadata, stripTermFrontMatter } from '@/modules/consents';
import { prisma } from '@/shared/lib/prisma';

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

  const data = await prisma.person.findUnique({
    where: { id: person.id },
    select: {
      phone: true,
      fullAddress: true,
      roleGrants: { where: { status: 'ACTIVE' }, select: { role: true }, take: 50 },
    },
  });

  const activeRoles = new Set(data?.roleGrants.map((g) => g.role) ?? []);
  const snapshot = { phone: data?.phone, fullAddress: data?.fullAddress };

  // Monta as opções: só papéis públicos ainda não ativos cujo termo carrega/valida.
  const options: ActivatableRoleOption[] = [];
  for (const role of PUBLIC_ROLES) {
    if (activeRoles.has(role)) continue;
    const purpose = ROLE_PURPOSE_MAP[role];
    try {
      const term = await loadTerm(purpose);
      const meta = purposeMetadata(purpose);
      options.push({
        role,
        label: ROLE_LABELS[role],
        purposeHumanName: meta.humanName,
        purposeDescription: meta.description,
        missingFields: missingProfileFields(snapshot, role),
        term: {
          version: term.version,
          contentHash: term.hash,
          body: stripTermFrontMatter(term.content),
        },
      });
    } catch {
      // Termo indisponível/integridade comprometida ⇒ papel não ativável agora
      // (P-004: nunca ativar sem o termo correto). Omitido da lista.
      continue;
    }
  }

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
