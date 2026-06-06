import Link from 'next/link';
import { env } from '@/shared/env';
import { CredentialClaimForm } from '@/modules/identity';

// Rota (auth): fluxo público de identidade — sem cache.
export const dynamic = 'force-dynamic';

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Reivindicar credencial</h1>
        <p className="mt-1 text-sm text-gray-600">
          Já tem cadastro feito pela assistente social, mas ainda não acessa o portal? Solicite a
          ativação da sua credencial de acesso.
        </p>
      </header>

      <CredentialClaimForm siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />

      <p className="text-sm text-gray-600">
        Já tem acesso?{' '}
        <Link href="/login" className="font-medium text-blue-600 hover:underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
