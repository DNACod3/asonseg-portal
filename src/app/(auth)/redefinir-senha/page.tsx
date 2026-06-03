import { PasswordResetForm } from '@/modules/identity';

export const metadata = {
  title: 'Definir nova senha — Portal ASONSEG',
  description: 'Defina uma nova senha para sua conta no Portal ASONSEG.',
};

// Rota de auth — sem cache (CLAUDE.md § Route Groups).
export const dynamic = 'force-dynamic';

/**
 * Página de redefinição de senha (USP-005 — #72). O `token_hash` chega na URL
 * pelo link do e-mail; sem ele, não há o que redefinir e orientamos a solicitar
 * um novo. O token só é consumido (uso único) quando o formulário é enviado.
 */
export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const { token_hash } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Definir nova senha</h1>
        <p className="mt-1 text-sm text-gray-500">Escolha uma nova senha para acessar sua conta.</p>
      </div>

      {token_hash ? (
        <PasswordResetForm token={token_hash} />
      ) : (
        <div className="flex flex-col gap-4">
          <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            Link inválido ou incompleto. Solicite uma nova redefinição de senha.
          </div>
          <p className="text-center text-xs text-gray-500">
            <a href="/recuperar-senha" className="font-medium text-blue-600 hover:underline">
              Solicitar novo link
            </a>
          </p>
        </div>
      )}
    </main>
  );
}
