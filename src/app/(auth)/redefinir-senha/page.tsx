import { PasswordResetForm } from '@/modules/identity';
import { FormCard, FormHeader, StepIcon } from '@/shared/ui';

export const metadata = {
  title: 'Definir nova senha — Portal ASONSEG',
  description: 'Defina uma nova senha para sua conta no Portal ASONSEG.',
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

/**
 * Página de redefinição de senha (USP-005 — #72). O `token_hash` chega na URL
 * pelo link do e-mail; sem ele, não há o que redefinir e orientamos a solicitar
 * um novo. O token só é consumido (uso único) quando o formulário é enviado.
 *
 * Refactor Fase 1 (AD-014, USP-005 delta): restilizado com StepIcon + FormHeader
 * + FormCard em ambos os ramos — leitura de `searchParams` e a condição
 * preservadas sem alteração.
 */
export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const { token_hash } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <StepIcon variant="blue">{lockIcon}</StepIcon>
      <FormHeader title="Definir nova senha" description="Escolha uma nova senha para acessar sua conta." />

      <FormCard>
        {token_hash ? (
          <PasswordResetForm token={token_hash} />
        ) : (
          <div className="flex flex-col gap-4">
            <div
              role="alert"
              className="rounded-sm bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-4 text-sm text-danger"
            >
              Link inválido ou incompleto. Solicite uma nova redefinição de senha.
            </div>
            <p className="text-center text-xs text-fg-muted">
              <a href="/recuperar-senha" className="font-medium text-primary hover:underline">
                Solicitar novo link
              </a>
            </p>
          </div>
        )}
      </FormCard>
    </main>
  );
}
