import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import { listPersonApplications } from '@/modules/jobs';
import { listPersonReferrals } from '@/modules/referrals';
import { listProviderServices, listPersonServiceInterests } from '@/modules/services';
import { listPersonCompanyGrants } from '@/modules/companies';
import { canViewConsolidatedPerson, viewPersonForSocialAssistant, ConsolidatedPersonPanel } from '@/modules/persons';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

/**
 * Visão consolidada de uma Pessoa (USP-039 / SOC-06) — painel único com todas
 * as dimensões da relação da Pessoa com a ASONSEG: dados pessoais + papéis
 * ativos, ficha socioeconômica (AS/BOARD apenas), candidaturas,
 * encaminhamentos, serviços oferecidos, manifestações de interesse e papéis
 * organizacionais. Sub-rota irmã de `ficha-social` (não sobrepõe a página de
 * gestão/inativação `(app)/pessoas/[id]`, USP-007).
 *
 * **Raiz de composição** (Assumption #5): esta página busca as 5 dimensões
 * cross-módulo (barrels `jobs`/`referrals`/`services`/`companies`) e as passa
 * ao assembler `viewPersonForSocialAssistant`, que mora em `persons` mas NÃO
 * importa esses barrels em runtime (evita o ciclo de módulo, lição AD-019).
 *
 * Restrita por papel: a sessão é revalidada pelo layout `(app)` (ADR-0030) e
 * aqui filtramos por `canViewConsolidatedPerson` (SOCIAL_ASSISTANT/BOARD/
 * COORDINATOR — **SOC-039-MN-02 na rota**). Quem não tem permissão recebe 404
 * — a rota não revela sua existência, e nenhuma dimensão é buscada. O
 * assembler repete a mesma guarda internamente (defesa em profundidade) e é a
 * fonte única de anonimização (**SOC-039-MN-01**: a ficha só é buscada/servida
 * para AS/BOARD — coordenador nunca aciona `getSocioeconomicRecord`).
 */
export default async function VisaoConsolidadaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireActivePerson();
  if (!canViewConsolidatedPerson(viewer.roles)) {
    notFound();
  }

  const { id } = await params;

  const [applications, referrals, servicesOffered, serviceInterests, companyGrants] = await Promise.all([
    listPersonApplications(id),
    listPersonReferrals(id),
    listProviderServices(id),
    listPersonServiceInterests(id),
    listPersonCompanyGrants(id),
  ]);

  const view = await viewPersonForSocialAssistant(id, viewer, {
    applications,
    referrals,
    servicesOffered,
    serviceInterests,
    companyGrants,
  });
  if (!view) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="font-heading text-2xl font-bold text-fg">Visão consolidada</h1>
        <p className="text-sm text-fg-muted">
          Relação integral da Pessoa com a ASONSEG — dados pessoais, ficha social, candidaturas,
          encaminhamentos, serviços e vínculos.
        </p>
      </header>
      <ConsolidatedPersonPanel view={view} />
    </main>
  );
}
