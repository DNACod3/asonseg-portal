import { env } from '@/shared/env';
import { LoginForm } from '@/modules/identity';
import { FormCard, FormHeader } from '@/shared/ui';

export const metadata = {
  title: 'Entrar — Portal ASONSEG',
  description: 'Acesse sua conta no Portal de Empregabilidade e Serviços da ASONSEG.',
};

// Rota de auth — sem cache (CLAUDE.md § Route Groups).
export const dynamic = 'force-dynamic';

// Fundação de Design System da Fase 1 (T13, DS-18): prova de paridade —
// FormHeader + FormCard envolvem o LoginForm restilizado com os primitivos.
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <FormHeader title="Entrar no ASONSEG" description="Use seu e-mail e senha para acessar." />
      <FormCard>
        <LoginForm siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
      </FormCard>
    </main>
  );
}
