import { redirect } from 'next/navigation';
import { env } from '@/shared/env';
import { RegisterPersonForm } from '@/modules/identity/components/RegisterPersonForm';
import type { RegisterPersonResult } from '@/modules/identity';

export const metadata = {
  title: 'Criar conta — Portal ASONSEG',
  description:
    'Cadastre-se no Portal de Empregabilidade e Serviços da ASONSEG para buscar emprego, oferecer serviços ou contratar prestadores.',
};

// Rota de auth — sem cache (CLAUDE.md § Route Groups)
export const dynamic = 'force-dynamic';

// Próximos passos por papel após o cadastro (E-002 das expectations)
const NEXT_STEP_BY_ROLE: Record<string, string> = {
  CANDIDATE: '/app/perfil/candidato/novo',
  PROVIDER: '/app/perfil/prestador/novo',
  CLIENT: '/app/perfil/cliente/novo',
};

/**
 * Callback chamado pelo RegisterPersonForm após TX1 bem-sucedida.
 * Redireciona para a tela de aceite da finalidade (TX2) — E-001b.
 * Implementado como Server Action para usar redirect() corretamente.
 */
async function handleRegistrationSuccess(result: RegisterPersonResult): Promise<void> {
  'use server';
  const nextStep = NEXT_STEP_BY_ROLE[result.role] ?? '/app/perfil';
  redirect(`/cadastro/consentimento?personId=${result.personId}&role=${result.role}&next=${nextStep}`);
}

export default function CadastroPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Criar conta no ASONSEG</h1>
        <p className="mt-1 text-sm text-gray-500">
          Preencha os dados abaixo para começar.
        </p>
      </div>

      <RegisterPersonForm
        siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        onSuccess={handleRegistrationSuccess}
      />

      <p className="text-center text-sm text-gray-500">
        Já tem conta?{' '}
        <a href="/login" className="font-medium text-blue-600 hover:underline">
          Entrar
        </a>
      </p>
    </main>
  );
}
