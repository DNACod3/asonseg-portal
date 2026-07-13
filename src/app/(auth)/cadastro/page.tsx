import { redirect } from 'next/navigation';
import { env } from '@/shared/env';
import { signConsentToken } from '@/shared/lib/consentToken';
import { RegisterPersonForm, registrationNextStep } from '@/modules/identity';
import type { RegisterPersonResult } from '@/modules/identity';
import { FormCard, FormHeader, StepIcon } from '@/shared/ui';

export const metadata = {
  title: 'Criar conta — Portal ASONSEG',
  description:
    'Cadastre-se no Portal de Empregabilidade e Serviços da ASONSEG para buscar emprego, oferecer serviços ou contratar prestadores.',
};

// Rota de auth — sem cache (CLAUDE.md § Route Groups)
export const dynamic = 'force-dynamic';

/**
 * Callback chamado pelo RegisterPersonForm após TX1 bem-sucedida.
 * Redireciona para a tela de aceite da finalidade (TX2) — E-001b.
 * O token HMAC garante que apenas quem passou pela TX1 pode acionar a TX2.
 *
 * `registrationNextStep` (USP-049 — REDIR-01/MN-01) substitui o antigo mapa
 * `NEXT_STEP_BY_ROLE`, que apontava a paths com o prefixo do route group
 * autenticado (que nunca vira URL) e a rotas inexistentes — causa raiz do
 * 404 no fim do cadastro (AUTH-1).
 */
async function handleRegistrationSuccess(result: RegisterPersonResult): Promise<void> {
  'use server';
  const nextStep = registrationNextStep(result.role);
  const sig = signConsentToken(result.personId, result.role);
  redirect(
    `/cadastro/consentimento?personId=${result.personId}&role=${result.role}&next=${encodeURIComponent(nextStep)}&sig=${sig}`,
  );
}

// SVG de usuário do protótipo (docs/prototipo/index.html L1228).
const userIcon = (
  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
    />
  </svg>
);

export default function CadastroPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <StepIcon variant="blue">{userIcon}</StepIcon>
      <FormHeader
        title="Criar conta no ASONSEG"
        description="Preencha os dados abaixo para começar."
      />

      <FormCard>
        <RegisterPersonForm
          siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          onSuccess={handleRegistrationSuccess}
        />
      </FormCard>

      <p className="text-center text-sm text-fg-muted">
        Já tem conta?{' '}
        <a href="/login" className="font-medium text-primary hover:underline">
          Entrar
        </a>
      </p>
    </main>
  );
}
