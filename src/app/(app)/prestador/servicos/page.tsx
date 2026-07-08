import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import { listProviderServices, viewProviderServiceRow, ServiceManagementList } from '@/modules/services';
import { FormHeader } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

/**
 * Painel de gestão de serviços do prestador (USP-032). Só uma Pessoa com papel
 * `PROVIDER` ativo acessa; caso contrário, `notFound()` (404 — mesmo padrão de
 * `/prestador/servicos/nova`). Lista todos os serviços do próprio prestador
 * (todos os status, PF e em nome de Empresas que representa) com ações
 * contextuais.
 */
export default async function GestaoServicosPage() {
  const person = await requireActivePerson();

  if (!person.roles.includes('PROVIDER')) {
    notFound();
  }

  const rawRows = await listProviderServices(person.id);
  const rows = rawRows.map(viewProviderServiceRow);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <FormHeader title="Meus serviços" description="Gestão dos serviços que você publicou." />
      <Link href="/prestador/manifestacoes" className="text-sm text-primary hover:underline">
        Ver manifestações de interesse recebidas →
      </Link>
      <ServiceManagementList rows={rows} />
    </main>
  );
}
