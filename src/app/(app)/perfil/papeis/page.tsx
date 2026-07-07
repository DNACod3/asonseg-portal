import { ActivateRoleForm, buildActivatableOptions, requireActivePerson } from '@/modules/identity';
import { FormHeader, StepIcon } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

// SVG de usuário do protótipo (docs/prototipo/index.html L1228) — mesmo ícone
// já reusado em cadastro/cadastro-assistido para fluxos centrados na Pessoa.
const userIcon = (
  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
    />
  </svg>
);

/**
 * "Ativar papel adicional" (USP-006). Lista os papéis públicos que a Pessoa
 * autenticada ainda não possui, exibindo apenas os campos faltantes de cada um
 * (E-001) e o termo específico da finalidade (P-004). Privacidade: usa o `id` da
 * própria Pessoa — a ativação opera exclusivamente sobre a sessão (P-002).
 *
 * Refactor da Fase 1 (AD-014): restilizado com `FormHeader`/`StepIcon` e tokens —
 * `dynamic`, `requireActivePerson`, o snapshot e `buildActivatableOptions`
 * preservados verbatim.
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
      <StepIcon variant="blue">{userIcon}</StepIcon>
      <FormHeader
        title="Ativar novo papel"
        description="Você pode usar o portal com mais de um papel usando o mesmo login. Ative um papel novo preenchendo apenas os dados que ainda faltam e aceitando o termo da finalidade correspondente — a ativação é imediata, sem etapa de aprovação."
      />

      <ActivateRoleForm options={options} />
    </main>
  );
}
