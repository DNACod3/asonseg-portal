import { requireActivePerson, missingProfileFields } from '@/modules/identity';
import { loadTerm, stripTermFrontMatter, TermLoaderError } from '@/modules/consents';
import { ProviderForm } from '@/modules/persons';
import { prisma } from '@/shared/lib/prisma';
import { FormCard, FormHeader, StepIcon } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

// SVG de silhueta/ferramenta de prestador (sem dependência externa).
const providerIcon = (
  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26"
    />
  </svg>
);

/**
 * Cadastro de prestador de serviço PF (USP-010 / #116). A Pessoa autenticada
 * ativa o papel prestador, aceita o termo SERVICE_OFFERING e registra o perfil
 * (título, descrição, região) em rascunho. Papel ativo imediatamente, sem
 * moderação (ADR-0015). O CNPJ MEI vive em `companies` via USP-012 (ADR-0031) —
 * aqui só há o redirect.
 *
 * Privacidade/P-005: opera sobre a própria sessão. As regiões são dados de
 * referência — leitura direta com select explícito + paginação (take).
 *
 * Fundação de Design System (AD-014/AD-015/AD-016/AD-019): layout restilizado
 * ao padrão de tela de cadastro (`StepIcon`+`FormHeader`+`FormCard`, como
 * `(app)/candidato/page.tsx`) — data-loading e props ao `ProviderForm`
 * inalterados.
 */
export default async function PrestadorPage() {
  const person = await requireActivePerson();

  const [regions, profile] = await Promise.all([
    prisma.region.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
    prisma.providerProfile.findUnique({
      where: { personId: person.id },
      select: { publicationStatus: true },
    }),
  ]);

  let term: { version: string; contentHash: string; body: string } | null = null;
  try {
    const loaded = await loadTerm('SERVICE_OFFERING');
    term = {
      version: loaded.version,
      contentHash: loaded.hash,
      body: stripTermFrontMatter(loaded.content),
    };
  } catch (err) {
    if (!(err instanceof TermLoaderError)) throw err;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <StepIcon variant="orange">{providerIcon}</StepIcon>
      <FormHeader
        title="Cadastro de prestador de serviço"
        description="Ative o papel de prestador para oferecer seus serviços no portal. Depois de ativar, você pode publicar seus serviços e aparecer nas buscas."
      />

      {term ? (
        <FormCard>
          <ProviderForm
            regions={regions}
            term={term}
            alreadyProvider={person.roles.includes('PROVIDER')}
            missingFields={missingProfileFields(person, 'PROVIDER')}
            initialStatus={profile?.publicationStatus ?? null}
          />
        </FormCard>
      ) : (
        <div
          role="alert"
          className="rounded-lg border border-danger bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] px-4 py-3 text-sm text-danger"
        >
          O termo de consentimento está indisponível no momento. Tente novamente mais tarde.
        </div>
      )}
    </main>
  );
}
