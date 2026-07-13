import { notFound, redirect } from 'next/navigation';
import { acceptRoleConsent, POST_AUTH_FALLBACK } from '@/modules/identity';
import { verifyConsentToken } from '@/shared/lib/consentToken';
import type { PublicRole } from '@/modules/identity';
import { Button, FormHeader, LgpdBox, StepIcon } from '@/shared/ui';

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

// SVG de escudo-check do protótipo (docs/prototipo/index.html L1340).
const shieldCheckIcon = (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
    />
  </svg>
);

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
  // A guarda também é re-validada dentro de `acceptRoleConsent` (defesa em
  // profundidade, U1-GUARD-01) — esta checagem na página evita renderizar o
  // formulário para um `sig` inválido.
  if (!sig || !verifyConsentToken(personId, typedRole, sig)) {
    notFound();
  }

  // Captura após os guards para que a closure async preserve o tipo string.
  const verifiedPersonId = personId;
  const verifiedSig = sig;
  // USP-049 (REDIR-02/03): fallback é o hub `/inicio` — não mais o antigo
  // destino com o prefixo do route group autenticado (nunca virava URL).
  const redirectTo = safeRedirect(next ? decodeURIComponent(next) : undefined, POST_AUTH_FALLBACK);

  async function acceptConsent() {
    'use server';
    const result = await acceptRoleConsent({
      personId: verifiedPersonId,
      role: typedRole,
      termVersion: ROLE_TERM_VERSION[typedRole],
      termContentHash: ROLE_TERM_HASH[typedRole],
      sig: verifiedSig,
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
      <StepIcon variant="green">{shieldCheckIcon}</StepIcon>
      <FormHeader
        title="Quase pronto!"
        description={`Para ativar o papel de ${ROLE_LABEL[typedRole]}, precisamos do seu aceite.`}
      />

      <LgpdBox title={`Autorização de uso de dados - ${ROLE_LABEL[typedRole]}`}>
        <p className="mb-4 text-sm leading-relaxed text-fg-muted">
          {ROLE_PURPOSE_DESCRIPTION[typedRole]}
        </p>
        <p className="text-xs text-fg-muted">
          Você pode revogar este consentimento a qualquer momento nas configurações da sua conta.
          Base legal: Art. 7º, I da Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018).
        </p>
      </LgpdBox>

      <form action={acceptConsent} className="flex flex-col gap-3">
        <Button type="submit" variant="primary" size="lg" className="w-full">
          Aceitar e ativar meu papel de {ROLE_LABEL[typedRole]}
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full">
          <a href={POST_AUTH_FALLBACK}>Aceitar depois</a>
        </Button>
      </form>

      <p className="text-center text-xs text-fg-muted">
        Sem aceitar, você já está cadastrado(a) no portal mas não poderá usar as
        funcionalidades de {ROLE_LABEL[typedRole].toLowerCase()} até confirmar.
      </p>
    </main>
  );
}
