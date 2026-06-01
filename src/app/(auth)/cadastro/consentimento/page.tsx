import { notFound, redirect } from 'next/navigation';
import { acceptRoleConsent } from '@/modules/identity';
import { verifyConsentToken } from '@/shared/lib/consentToken';
import type { PublicRole } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Termos aprovados pela diretoria/jurídico (D-004 cleared).
// Hashes SHA-256 de legal/consent-terms/<finalidade>/v1.0.md.
const ROLE_TERM_VERSION: Record<PublicRole, string> = {
  CANDIDATE: 'job-application@v1.0',
  PROVIDER: 'service-offering@v1.0',
  CLIENT: 'service-hiring@v1.0',
};

const ROLE_TERM_HASH: Record<PublicRole, string> = {
  CANDIDATE: 'cba5ec9a519b6c5d2beab0adaf693252c87d95a9353877b9f3c43d41dfb064dd',
  PROVIDER: '9abdc14dbe425e0422987d5b5fc6002f942b90ac053c5d6a9b423640907a88a7',
  CLIENT: 'cc05674f573f8ea3c5a50e1e731d7d929684a4ffb5d65f34d4bcc40d5d472803',
};

const ROLE_LABEL: Record<PublicRole, string> = {
  CANDIDATE: 'Candidato(a)',
  PROVIDER: 'Prestador(a) de Serviços',
  CLIENT: 'Cliente',
};

const ROLE_PURPOSE_DESCRIPTION: Record<PublicRole, string> = {
  CANDIDATE:
    'Autorizo o uso dos meus dados para candidatura a vagas de emprego publicadas por empresas parceiras da ASONSEG.',
  PROVIDER:
    'Autorizo o uso dos meus dados para oferta de serviços no catálogo do portal ASONSEG.',
  CLIENT:
    'Autorizo o uso dos meus dados para contratação de serviços de prestadores cadastrados no portal ASONSEG.',
};

const PUBLIC_ROLES = ['CANDIDATE', 'PROVIDER', 'CLIENT'] as const satisfies PublicRole[];

/**
 * Valida que o destino de redirect é uma rota interna relativa.
 * Rejeita URLs externas e protocol-relative (//) para prevenir open redirect.
 */
function safeRedirect(next: string | undefined, fallback: string): string {
  if (next && /^\/[^/]/.test(next)) return next;
  return fallback;
}

interface Props {
  readonly searchParams: Promise<{ personId?: string; role?: string; next?: string; sig?: string }>;
}

export default async function ConsentimentoPage({ searchParams }: Props) {
  const params = await searchParams;
  const { personId, role, next, sig } = params;

  if (
    !personId ||
    !role ||
    !(PUBLIC_ROLES as readonly string[]).includes(role)
  ) {
    notFound();
  }

  const typedRole = role as PublicRole;

  // Verifica token HMAC: garante que apenas quem passou pela TX1 (registerPerson)
  // pode acionar a TX2 para este personId, prevenindo ativação por terceiros.
  if (!verifyConsentToken(personId, typedRole, sig)) {
    notFound();
  }

  // Captura após os guards para que a closure async preserve o tipo string.
  const verifiedPersonId = personId;
  const redirectTo = safeRedirect(next ? decodeURIComponent(next) : undefined, '/app/perfil');

  async function acceptConsent() {
    'use server';
    const result = await acceptRoleConsent({
      personId: verifiedPersonId,
      role: typedRole,
      termVersion: ROLE_TERM_VERSION[typedRole],
      termContentHash: ROLE_TERM_HASH[typedRole],
    });

    if (result.ok) {
      redirect(redirectTo);
    }
    redirect(
      `/cadastro/consentimento?personId=${verifiedPersonId}&role=${role}&next=${encodeURIComponent(redirectTo)}&sig=${sig}&erro=${result.error.code}`,
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Quase pronto!</h1>
        <p className="mt-1 text-sm text-gray-500">
          Para ativar o papel de <strong>{ROLE_LABEL[typedRole]}</strong>, precisamos do seu aceite.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          Autorização de uso de dados — {ROLE_LABEL[typedRole]}
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-gray-600">
          {ROLE_PURPOSE_DESCRIPTION[typedRole]}
        </p>
        <p className="text-xs text-gray-400">
          Você pode revogar este consentimento a qualquer momento nas configurações da sua conta.
          Base legal: Art. 7º, I da Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).
        </p>
      </div>

      <form action={acceptConsent} className="flex flex-col gap-3">
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          Aceitar e ativar meu papel de {ROLE_LABEL[typedRole]}
        </button>
        <a
          href="/app/perfil"
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Aceitar depois
        </a>
      </form>

      <p className="text-center text-xs text-gray-400">
        Sem aceitar, você já está cadastrado(a) no portal mas não poderá usar as
        funcionalidades de {ROLE_LABEL[typedRole].toLowerCase()} até confirmar.
      </p>
    </main>
  );
}
