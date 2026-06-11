import { requireActivePerson, missingProfileFields } from '@/modules/identity';
import { loadTerm, stripTermFrontMatter, TermLoaderError } from '@/modules/consents';
import { ProviderForm } from '@/modules/persons';
import { prisma } from '@/shared/lib/prisma';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

/**
 * Cadastro de prestador de serviço PF (USP-010 / #116). A Pessoa autenticada
 * ativa o papel prestador, aceita o termo SERVICE_OFFERING e registra o perfil
 * (título, descrição, região) em rascunho. Papel ativo imediatamente, sem
 * moderação (ADR-0015). O CNPJ MEI vive em `companies` via USP-012 (ADR-0031) —
 * aqui só há o redirect.
 *
 * Privacidade/P-005: opera sobre a própria sessão. As regiões são dados de
 * referência — leitura direta com select explícito + paginação (take).
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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Cadastro de prestador de serviço</h1>
        <p className="mt-1 text-sm text-gray-600">
          Ative o papel de prestador para oferecer seus serviços no portal. Depois de ativar, você
          pode publicar seus serviços e aparecer nas buscas.
        </p>
      </header>

      {term ? (
        <ProviderForm
          regions={regions}
          term={term}
          alreadyProvider={person.roles.includes('PROVIDER')}
          missingFields={missingProfileFields(person, 'PROVIDER')}
          initialStatus={profile?.publicationStatus ?? null}
        />
      ) : (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
        >
          O termo de consentimento está indisponível no momento. Tente novamente mais tarde.
        </div>
      )}
    </main>
  );
}
