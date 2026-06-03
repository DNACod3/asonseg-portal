import { env } from '@/shared/env';
import { PasswordResetRequestForm } from '@/modules/identity';

export const metadata = {
  title: 'Recuperar senha — Portal ASONSEG',
  description: 'Receba por e-mail um link para redefinir a senha da sua conta no Portal ASONSEG.',
};

// Rota de auth — sem cache (CLAUDE.md § Route Groups).
export const dynamic = 'force-dynamic';

export default function RecuperarSenhaPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Recuperar senha</h1>
        <p className="mt-1 text-sm text-gray-500">
          Informe o e-mail da sua conta. Se houver cadastro, enviaremos um link para você definir
          uma nova senha.
        </p>
      </div>

      <PasswordResetRequestForm siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
    </main>
  );
}
