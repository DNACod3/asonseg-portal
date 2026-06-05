import { notFound } from 'next/navigation';
import { requireActivePerson, canRegisterAssisted, AssistedRegisterForm } from '@/modules/identity';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

/**
 * Cadastro assistido de Pessoa pela assistente social (USP-002).
 *
 * Rota visível apenas a AS/diretoria: a Pessoa autenticada é revalidada pelo
 * layout `(app)` (ADR-0030) e aqui filtramos pelo papel. Quem não tem permissão
 * recebe 404 — a rota não revela sua existência (E-005). A Server Action
 * `registerPersonByAssistant` repete a checagem (defesa em profundidade / D-004).
 */
export default async function CadastroAssistidoPage() {
  const person = await requireActivePerson();
  if (!canRegisterAssisted(person.roles)) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Cadastro assistido de Pessoa</h1>
        <p className="mt-1 text-sm text-gray-600">
          Cadastre uma Pessoa que não consegue fazer o auto-cadastro (sem capacidade digital, sem
          documento, etc.). Apenas o nome é obrigatório. A Pessoa é criada sem credencial de acesso —
          existe no sistema e pode ser referenciada em encaminhamentos, ficha social e relatórios,
          mas não acessa o portal até reivindicar uma credencial.
        </p>
      </header>

      <AssistedRegisterForm />

      <p className="text-xs text-gray-500">
        O termo de consentimento do atendimento social é assinado em papel, fora do sistema, no
        momento do atendimento (LGPD). Toda criação de Pessoa por esta via fica registrada na
        auditoria com a sua identidade, data e hora.
      </p>
    </main>
  );
}
