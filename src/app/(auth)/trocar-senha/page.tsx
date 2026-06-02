import { ChangePasswordForm } from '@/modules/identity';

export const metadata = {
  title: 'Trocar senha — Portal ASONSEG',
  description: 'Defina uma nova senha para concluir seu primeiro acesso.',
};

// Rota de auth — sem cache (CLAUDE.md § Route Groups).
export const dynamic = 'force-dynamic';

export default function TrocarSenhaPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Defina sua nova senha</h1>
        <p className="mt-1 text-sm text-gray-500">
          Este é seu primeiro acesso. Por segurança, escolha uma nova senha para continuar.
        </p>
      </div>

      <ChangePasswordForm />
    </main>
  );
}
