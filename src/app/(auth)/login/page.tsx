import { LoginForm } from '@/modules/identity';

export const metadata = {
  title: 'Entrar — Portal ASONSEG',
  description: 'Acesse sua conta no Portal de Empregabilidade e Serviços da ASONSEG.',
};

// Rota de auth — sem cache (CLAUDE.md § Route Groups).
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Entrar no ASONSEG</h1>
        <p className="mt-1 text-sm text-gray-500">Use seu e-mail e senha para acessar.</p>
      </div>

      <LoginForm />
    </main>
  );
}
