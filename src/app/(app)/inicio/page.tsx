import { requireActivePerson, orderActiveRolePanels, type PanelKey } from '@/modules/identity';
import { canAccessModerationQueue } from '@/modules/moderation';
import { firstNameOf } from '@/modules/persons';
import { FormHeader } from '@/shared/ui';
import { loadCandidatePanel } from './_loaders/candidate';
import { loadProviderPanel } from './_loaders/provider';
import { loadClientPanel } from './_loaders/client';
import { loadCompanyPanel } from './_loaders/company';
import { loadInstitutionalPanel } from './_loaders/institutional';
import { CandidateBlock } from './_components/candidate-block';
import { ProviderBlock } from './_components/provider-block';
import { ClientBlock } from './_components/client-block';
import { CompanyBlock } from './_components/company-block';
import { InstitutionalBlock } from './_components/institutional-block';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

/** Papéis inerentes que dão acesso ao bloco institucional (fora da delegação de VOLUNTEER). */
const INSTITUTIONAL_ROLES = ['COORDINATOR', 'SOCIAL_ASSISTANT', 'BOARD'];

/**
 * Painel `/inicio` por papel (USP-067 — PNL-00, substitui o hub de atalhos da
 * USP-049). Composition-root (ADR-0030 / AD-022): resolve sessão + acesso,
 * calcula os blocos ativos na ordem de `ALL_ROLE_LABELS` (A-17) e chama, em
 * `Promise.all`, só os loaders necessários — cada um degrada por dimensão
 * (try/catch → fallback), nunca derruba a página inteira (P1.0-7).
 *
 * `institutional` (visibilidade do bloco) é `roles ∩ {COORDINATOR,
 * SOCIAL_ASSISTANT, BOARD}` **ou** o guard ao vivo `canAccessModerationQueue`
 * (cobre o voluntário só-delegado) — a MESMA fonte que `hubAccessFromRoles`/
 * `buildHubLinks` usavam para o grupo institucional (PNL-MN-04): nunca uma
 * leitura ad-hoc que a rota-alvo negaria.
 *
 * SPEC_DEVIATION (justificado, não enfraquecimento): o hub-de-atalhos
 * (`buildHubLinks`, "Minha conta"/"Meus papéis"/"Institucional") é
 * substituído pelo painel. A navegação para perfil/consentimentos/ativar
 * papel segue disponível via a casca `(app)` (sidebar/bottom nav — AD-027/
 * AD-028, USP-061) — não recriada aqui.
 */
export default async function InicioPage() {
  const person = await requireActivePerson();
  const canModerate = await canAccessModerationQueue(person);
  const institutional = canModerate || person.roles.some((role) => INSTITUTIONAL_ROLES.includes(role));

  const activePanels = orderActiveRolePanels(person.roles, { institutional });

  const [candidateData, providerData, clientData, companyData, institutionalData] = await Promise.all([
    activePanels.includes('CANDIDATE') ? loadCandidatePanel(person) : Promise.resolve(null),
    activePanels.includes('PROVIDER') ? loadProviderPanel(person) : Promise.resolve(null),
    activePanels.includes('CLIENT') ? loadClientPanel(person) : Promise.resolve(null),
    activePanels.includes('COMPANY_RESPONSIBLE') ? loadCompanyPanel(person) : Promise.resolve(null),
    activePanels.includes('INSTITUTIONAL')
      ? loadInstitutionalPanel(person, person.roles, canModerate)
      : Promise.resolve(null),
  ]);

  const blocksByKey: Record<PanelKey, React.ReactNode> = {
    CANDIDATE: candidateData && <CandidateBlock data={candidateData} />,
    PROVIDER: providerData && <ProviderBlock data={providerData} />,
    CLIENT: clientData && <ClientBlock data={clientData} />,
    COMPANY_RESPONSIBLE: companyData && <CompanyBlock data={companyData} />,
    INSTITUTIONAL: institutionalData && <InstitutionalBlock data={institutionalData} />,
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
      <FormHeader
        title={`Olá, ${firstNameOf(person.fullName)}`}
        description="Seus indicadores, ações rápidas e listas — tudo na primeira tela."
      />

      {activePanels.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Você ainda não tem nenhum papel ativo. Use o menu para ativar um papel ou gerenciar sua conta.
        </p>
      ) : (
        activePanels.map((key) => <div key={key}>{blocksByKey[key]}</div>)
      )}
    </main>
  );
}
