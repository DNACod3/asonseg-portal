import { loadTerm, purposeMetadata, stripTermFrontMatter } from '@/modules/consents';
import type { ActivatableRoleOption } from '../components/activate-role-form';
import { missingProfileFields, ROLE_LABELS, type ProfileSnapshot } from '../domain/role-activation';
import { PUBLIC_ROLES, ROLE_PURPOSE_MAP } from '../schemas/registerPerson';

/**
 * Monta as opções de papel ativável da página `(app)/perfil/papeis` (USP-006).
 *
 * Para cada papel público que a Pessoa ainda não possui, carrega o termo vigente
 * da finalidade **server-side** (`loadTerm` valida o SHA-256 contra o registro —
 * P-004) e calcula os campos de perfil faltantes (E-001). Os termos são carregados
 * em paralelo (`Promise.allSettled`): um termo indisponível/adulterado remove
 * **apenas o próprio papel** da lista — nunca ativa sem o termo correto (P-004) —,
 * mantendo os demais papéis disponíveis.
 *
 * Helper server-only (lê arquivos de termo): não faz IO de Pessoa — recebe o
 * snapshot e os papéis já ativos prontos, o que o torna testável sem banco.
 */
export async function buildActivatableOptions(
  snapshot: ProfileSnapshot,
  activeRoles: ReadonlySet<string>,
): Promise<ActivatableRoleOption[]> {
  const settled = await Promise.allSettled(
    PUBLIC_ROLES.filter((role) => !activeRoles.has(role)).map(
      async (role): Promise<ActivatableRoleOption> => {
        const purpose = ROLE_PURPOSE_MAP[role];
        const term = await loadTerm(purpose);
        const meta = purposeMetadata(purpose);
        return {
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
        };
      },
    ),
  );

  return settled
    .filter(
      (r): r is PromiseFulfilledResult<ActivatableRoleOption> => r.status === 'fulfilled',
    )
    .map((r) => r.value);
}
