import { notFound } from 'next/navigation';
import { requireActivePerson, canRegisterAssisted, AssistedRegisterForm } from '@/modules/identity';
import { FormCard, FormHeader, StepIcon } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

// SVG de usuário do protótipo (docs/prototipo/index.html L1228).
const userIcon = (
  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
    />
  </svg>
);

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
      <StepIcon variant="blue">{userIcon}</StepIcon>
      <FormHeader
        title="Cadastro assistido de Pessoa"
        description="Cadastre uma Pessoa que não consegue fazer o auto-cadastro (sem capacidade digital, sem documento, etc.). Apenas o nome é obrigatório. A Pessoa é criada sem credencial de acesso — existe no sistema e pode ser referenciada em encaminhamentos, ficha social e relatórios, mas não acessa o portal até reivindicar uma credencial."
      />

      <FormCard>
        <AssistedRegisterForm />
      </FormCard>

      <p className="text-xs text-fg-muted">
        O termo de consentimento do atendimento social é assinado em papel, fora do sistema, no
        momento do atendimento (LGPD). Toda criação de Pessoa por esta via fica registrada na
        auditoria com a sua identidade, data e hora.
      </p>
    </main>
  );
}
