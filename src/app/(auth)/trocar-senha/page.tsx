import { ChangePasswordForm, getCurrentPerson } from '@/modules/identity';
import { FormCard, FormHeader, StepIcon } from '@/shared/ui';

export const metadata = {
  title: 'Trocar senha — Portal ASONSEG',
  description: 'Defina uma nova senha para concluir seu primeiro acesso.',
};

// Rota de auth — sem cache (CLAUDE.md § Route Groups).
export const dynamic = 'force-dynamic';

// SVG de cadeado (linguagem do protótipo — glifo discricionário/decorativo).
const lockIcon = (
  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
    />
  </svg>
);

// Refactor Fase 1 (AD-014, USP-004 delta): restilizado com StepIcon + FormHeader
// + FormCard, seguindo o padrão do login/page.tsx e cadastro/page.tsx.
//
// AUTH-7 / RF-06 / RF-MN-05: a página NÃO confina fora do 1º acesso (ADR-0030
// mantém `/trocar-senha` acessível) — só a descrição passa a ser condicional a
// `primeiroAcesso`, para não afirmar "primeiro acesso" enganosamente quando não é.
export default async function TrocarSenhaPage() {
  const person = await getCurrentPerson();
  const description = person?.primeiroAcesso
    ? 'Este é seu primeiro acesso. Por segurança, escolha uma nova senha para continuar.'
    : 'Por segurança, escolha uma nova senha para continuar.';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <StepIcon variant="blue">{lockIcon}</StepIcon>
      <FormHeader title="Defina sua nova senha" description={description} />

      <FormCard>
        <ChangePasswordForm />
      </FormCard>
    </main>
  );
}
