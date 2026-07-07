import Link from 'next/link';
import { env } from '@/shared/env';
import { CredentialClaimForm } from '@/modules/identity';
import { FormCard, FormHeader, StepIcon } from '@/shared/ui';

// Rota (auth): fluxo público de identidade — sem cache.
export const dynamic = 'force-dynamic';

// SVG de chave do protótipo (docs/prototipo/index.html L1228).
const keyIcon = (
  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z"
    />
  </svg>
);

/**
 * Solicitação de reivindicação de credencial (USP-003 / IDN-07).
 *
 * Página pública: uma Pessoa pré-cadastrada pela AS (USP-002) — ou familiar
 * autorizado — pede a ativação de uma credencial. A solicitação fica pendente
 * até a verificação manual de identidade pela AS/diretoria (D-011). A resposta é
 * sempre genérica, sem revelar se a Pessoa existe (P-006).
 */
export default function ReivindicarCredencialPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <StepIcon variant="blue">{keyIcon}</StepIcon>
      <FormHeader
        title="Reivindicar credencial"
        description="Já tem cadastro feito pela assistente social, mas ainda não acessa o portal? Solicite a ativação da sua credencial de acesso."
      />

      <FormCard>
        <CredentialClaimForm siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
      </FormCard>

      <p className="text-center text-sm text-fg-muted">
        Já tem acesso?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
