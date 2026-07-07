import { requireActivePerson } from '@/modules/identity';
import { loadTerm, stripTermFrontMatter } from '@/modules/consents';
import { CreateCompanyForm } from '@/modules/companies';
import { FormCard, FormHeader, StepIcon } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

// SVG de prédio/empresa do protótipo (docs/prototipo/index.html L1368).
const buildingIcon = (
  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
    />
  </svg>
);

/**
 * Cadastro de Empresa (USP-012). Carrega o termo COMPANY_REPRESENTATION
 * vigente server-side (versão + hash íntegros) e renderiza o formulário.
 * Só Pessoas autenticadas acessam — `requireActivePerson` redireciona para
 * login quando não há sessão (padrão das rotas `(app)`).
 */
export default async function CadastrarEmpresaPage() {
  await requireActivePerson();

  const term = await loadTerm('COMPANY_REPRESENTATION');

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <StepIcon variant="orange">{buildingIcon}</StepIcon>
      <FormHeader
        title="Cadastro de Empresa"
        description="Cadastre sua Empresa para publicar vagas e serviços no portal."
      />
      <FormCard>
        <CreateCompanyForm
          term={{
            version: term.version,
            contentHash: term.hash,
            body: stripTermFrontMatter(term.content),
          }}
        />
      </FormCard>
    </main>
  );
}
