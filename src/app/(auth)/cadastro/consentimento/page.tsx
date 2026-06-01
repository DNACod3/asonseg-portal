import { notFound, redirect } from 'next/navigation';
import crypto from 'node:crypto';
import { acceptRoleConsent } from '@/modules/identity';
import type { PublicRole } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Versões dos termos por papel (D-004 — gate jurídico: substituir pelos termos aprovados)
const ROLE_TERM_VERSION: Record<PublicRole, string> = {
  CANDIDATE: 'job-application@v1.0-draft',
  PROVIDER: 'service-offering@v1.0-draft',
  CLIENT: 'service-hiring@v1.0-draft',
};

// Placeholder de hash — substituir pelo SHA-256 do texto aprovado pelo jurídico (D-004)
const ROLE_TERM_HASH: Record<PublicRole, string> = {
  CANDIDATE: crypto.createHash('sha256').update('PLACEHOLDER candidato').digest('hex'),
  PROVIDER: crypto.createHash('sha256').update('PLACEHOLDER prestador').digest('hex'),
  CLIENT: crypto.createHash('sha256').update('PLACEHOLDER cliente').digest('hex'),
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

interface Props {
  searchParams: Promise<{ personId?: string; role?: string; next?: string }>;
}

export default async function ConsentimentoPage({ searchParams }: Props) {
  const params = await searchParams;
  const { personId, role, next } = params;

  if (
    !personId ||
    !role ||
    !(PUBLIC_ROLES as readonly string[]).includes(role)
  ) {
    notFound();
  }

  const typedRole = role as PublicRole;
  const redirectTo = next ?? '/app/perfil';

  async function acceptConsent() {
    'use server';
    const result = await acceptRoleConsent({
      personId: personId!,
      role: typedRole,
      termVersion: ROLE_TERM_VERSION[typedRole],
      termContentHash: ROLE_TERM_HASH[typedRole],
    });

    if (result.ok) {
      redirect(redirectTo);
    }
    // Em caso de erro, redireciona de volta (não ideal — melhorar com state em próxima iteração)
    redirect(`/cadastro/consentimento?personId=${personId}&role=${role}&next=${redirectTo}&erro=${result.error.code}`);
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
