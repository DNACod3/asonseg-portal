import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import { listProviderInterests, ProviderInterestsList } from '@/modules/services';
import { FormHeader } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

/**
 * Painel "manifestações recebidas" do prestador (USP-035 — AC-035-1). Só uma
 * Pessoa com papel `PROVIDER` ativo acessa; caso contrário, `notFound()`
 * (mesmo padrão de `/prestador/servicos`). Lista as manifestações ATIVAS de
 * todos os serviços do prestador — `listProviderInterests` já é a fonte única
 * de auditoria (`SENSITIVE_FIELD_VIEWED` por cliente exibido); a página só
 * consome o resultado, nunca o Prisma.
 */
export default async function ManifestacoesRecebidasPage() {
  const person = await requireActivePerson();

  if (!person.roles.includes('PROVIDER')) {
    notFound();
  }

  const res = await listProviderInterests(person);
  if (!res.ok) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <FormHeader
        title="Manifestações recebidas"
        description={`${res.data.total} ${res.data.total === 1 ? 'manifestação ativa' : 'manifestações ativas'}.`}
      />
      <ProviderInterestsList items={res.data.interests} />
    </main>
  );
}
