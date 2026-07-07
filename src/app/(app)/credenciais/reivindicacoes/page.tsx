import { notFound } from 'next/navigation';
import { formatSaoPaulo } from '@/shared/lib/time';
import {
  requireActivePerson,
  canApproveCredentialClaim,
  listPendingCredentialClaims,
  CredentialClaimReview,
} from '@/modules/identity';
import { FormHeader, StepIcon } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

// SVG de checklist do protótipo (docs/prototipo/index.html L1228).
const reviewIcon = (
  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </svg>
);

/**
 * Fila de verificação de reivindicações de credencial (USP-003 / IDN-08 / D-004).
 *
 * Visível apenas a aprovadores (AS/coordenação/diretoria). Quem não tem permissão
 * recebe 404 — a rota não revela sua existência (L-004). A Server Action
 * `verifyCredentialClaim` repete a checagem (defesa em profundidade / P-005).
 */
export default async function ReivindicacoesPage() {
  const person = await requireActivePerson();
  if (!canApproveCredentialClaim(person.roles)) {
    notFound();
  }

  const claims = await listPendingCredentialClaims();
  const items = claims.map((c) => ({
    id: c.id,
    personId: c.personId,
    fullName: c.fullName,
    requestedEmail: c.requestedEmail,
    verificationMethod: c.verificationMethod,
    requestedAtLabel: formatSaoPaulo(c.requestedAt, "dd/MM/yyyy 'às' HH:mm"),
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <StepIcon variant="orange">{reviewIcon}</StepIcon>
      <FormHeader
        title="Reivindicações de credencial"
        description="Solicitações pendentes de ativação de credencial. Confirme a verificação de identidade pelo canal seguro definido (telefone/videochamada) antes de ativar. Toda confirmação fica registrada na auditoria com o seu nome, o meio utilizado e a data/hora."
      />

      <CredentialClaimReview items={items} />
    </main>
  );
}
