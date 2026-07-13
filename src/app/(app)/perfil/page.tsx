import { notFound } from 'next/navigation';
import { requireActivePerson, ALL_ROLE_LABELS, SignOutForm } from '@/modules/identity';
import { viewPersonForSelf } from '@/modules/persons';
import { Badge, Card, FormHeader } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

/**
 * Tela real do titular (USP-049 — AUTH-4): substitui o placeholder de dev por
 * uma tela mínima com os próprios dados (View Model self `viewPersonForSelf`,
 * PERFIL-MN-01 — só o `person.id` da sessão) + atalhos + logout.
 */
export default async function PerfilPage() {
  const person = await requireActivePerson();
  const profile = await viewPersonForSelf(person.id);

  // Defensivo: a sessão já garantiu uma Pessoa ATIVA; a ausência aqui seria
  // uma corrida rara (ex.: exclusão concorrente). Nunca renderiza dados de
  // outra Pessoa como substituto.
  if (!profile) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-10">
      <FormHeader title="Meu perfil" description="Seus dados, papéis e atalhos de conta." />

      <Card className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-fg-muted">Nome completo</p>
          <p className="font-heading text-base font-semibold text-fg">{profile.fullName}</p>
        </div>
        <div>
          <p className="text-sm text-fg-muted">E-mail</p>
          <p className="text-base text-fg">{profile.emailLogin}</p>
        </div>
        <div>
          <p className="text-sm text-fg-muted">CPF</p>
          <p className="text-base text-fg">{profile.cpfMasked}</p>
        </div>
        <div>
          <p className="mb-2 text-sm text-fg-muted">Papéis ativos</p>
          {profile.roles.length === 0 ? (
            <p className="text-sm text-fg-muted">Nenhum papel ativo ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profile.roles.map((role) => (
                <Badge key={role} variant="blue">
                  {ALL_ROLE_LABELS[role] ?? role}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>

      <nav className="flex flex-col gap-2">
        <a
          href="/perfil/papeis"
          className="rounded-md border border-border bg-background px-4 py-3 text-sm font-medium text-fg hover:border-primary hover:text-primary"
        >
          Ativar um papel
        </a>
        <a
          href="/consentimentos"
          className="rounded-md border border-border bg-background px-4 py-3 text-sm font-medium text-fg hover:border-primary hover:text-primary"
        >
          Meus consentimentos
        </a>
      </nav>

      <SignOutForm />
    </main>
  );
}
