import { requireActivePerson } from '@/modules/identity';
import { loadTerm, requireActiveConsent, stripTermFrontMatter, TermLoaderError } from '@/modules/consents';
import { CandidateForm, type EducationLevel } from '@/modules/persons';
import { CvUploadForm } from '@/modules/cv-extraction';
import { prisma } from '@/shared/lib/prisma';
import { FormCard, FormHeader, FormSectionTitle, StepIcon } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

// SVG de silhueta de usuário/candidato (sem dependência externa).
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
 * Cadastro de candidato (USP-009 / #46). A Pessoa autenticada preenche o perfil
 * (escolaridade, área de interesse, telefone, etc.), aceita o termo JOB_APPLICATION
 * e ativa o papel candidato (perfil em rascunho), podendo enviá-lo para moderação.
 *
 * Privacidade/P-002: opera sobre a própria sessão. As taxonomias (JobArea) são
 * dados de referência — leitura direta com select explícito + paginação (take).
 *
 * Fundação de Design System (AD-014/AD-015/AD-016, Fase 3 unidade U1): layout
 * restilizado ao padrão de tela de cadastro (`StepIcon`+`FormHeader`+`FormCard`,
 * como `(app)/empresa/cadastrar`) — data-loading e props ao `CandidateForm`
 * inalterados.
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
      select: {
        publicationStatus: true,
        educationLevel: true,
        primaryAreaOfInterestId: true,
        headline: true,
        experienceText: true,
      },
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

  // CAND-3: perfil existente pré-preenche o formulário (edição não-às-cegas).
  // educationLevel vem do banco como string livre (coluna sem enum nativo —
  // domínio validado na fronteira Zod); undefined quando ausente/fora do
  // domínio, para não forçar um valor inválido no <select> (o formulário
  // trata a ausência como "não selecionado", igual ao candidato novo).
  const defaultValues = {
    educationLevel: profile?.educationLevel as EducationLevel | undefined,
    primaryAreaOfInterestId: profile?.primaryAreaOfInterestId ?? '',
    phone: person.phone ?? '',
    headline: profile?.headline ?? '',
    experienceText: profile?.experienceText ?? '',
  };

  // CAND-6: termo + consentimento CV_AI_EXTRACTION, para o CvUploadForm conceder
  // o aceite antes do upload (mesmo padrão do termo JOB_APPLICATION acima).
  let cvTerm: { version: string; contentHash: string; body: string } | null = null;
  try {
    const loadedCvTerm = await loadTerm('CV_AI_EXTRACTION');
    cvTerm = {
      version: loadedCvTerm.version,
      contentHash: loadedCvTerm.hash,
      body: stripTermFrontMatter(loadedCvTerm.content),
    };
  } catch (err) {
    if (!(err instanceof TermLoaderError)) throw err;
  }
  const alreadyGrantedCv = (await requireActiveConsent(person.id, 'CV_AI_EXTRACTION')).active;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <StepIcon variant="orange">{userIcon}</StepIcon>
      <FormHeader
        title="Cadastro de candidato"
        description="Preencha seus dados para aparecer nas buscas de empresas e se candidatar a vagas. Após salvar, envie o perfil para moderação — ele fica visível depois da aprovação do coordenador."
      />

      {term ? (
        <FormCard>
          <CandidateForm
            jobAreas={jobAreas}
            term={term}
            alreadyCandidate={person.roles.includes('CANDIDATE')}
            initialStatus={profile?.publicationStatus ?? null}
            defaultValues={defaultValues}
          />
        </FormCard>
      ) : (
        <div
          role="alert"
          className="rounded-lg bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] border border-danger px-4 py-3 text-sm text-danger"
        >
          O termo de consentimento está indisponível no momento. Tente novamente mais tarde.
        </div>
      )}

      {/* USP-040 — upload/extração de CV por IA: exige perfil de candidato já
          criado (precondição de `uploadCv`). */}
      {profile && (
        <FormCard className="mt-6">
          <FormSectionTitle>Extrair dados do currículo (opcional)</FormSectionTitle>
          <CvUploadForm term={cvTerm} alreadyGranted={alreadyGrantedCv} />
        </FormCard>
      )}
    </main>
  );
}
