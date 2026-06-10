import { requireActivePerson } from '@/modules/identity';
import { loadTerm, stripTermFrontMatter, TermLoaderError } from '@/modules/consents';
import { CandidateForm } from '@/modules/persons';
import { prisma } from '@/shared/lib/prisma';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

/**
 * Cadastro de candidato (USP-009 / #46). A Pessoa autenticada preenche o perfil
 * (escolaridade, área de interesse, telefone, etc.), aceita o termo JOB_APPLICATION
 * e ativa o papel candidato (perfil em rascunho), podendo enviá-lo para moderação.
 *
 * Privacidade/P-002: opera sobre a própria sessão. As taxonomias (JobArea) são
 * dados de referência — leitura direta com select explícito + paginação (take).
 */
export default async function CandidatoPage() {
  const person = await requireActivePerson();

  const [jobAreas, profile] = await Promise.all([
    prisma.jobArea.findMany({
      where: { isSuggestion: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
    prisma.candidateProfile.findUnique({
      where: { personId: person.id },
      select: { publicationStatus: true },
    }),
  ]);

  let term: { version: string; contentHash: string; body: string } | null = null;
  try {
    const loaded = await loadTerm('JOB_APPLICATION');
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
        <h1 className="text-2xl font-bold text-gray-900">Cadastro de candidato</h1>
        <p className="mt-1 text-sm text-gray-600">
          Preencha seus dados para aparecer nas buscas de empresas e se candidatar a vagas. Após
          salvar, envie o perfil para moderação — ele fica visível depois da aprovação do coordenador.
        </p>
      </header>

      {term ? (
        <CandidateForm
          jobAreas={jobAreas}
          term={term}
          alreadyCandidate={person.roles.includes('CANDIDATE')}
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
