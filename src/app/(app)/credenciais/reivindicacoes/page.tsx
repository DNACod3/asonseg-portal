import { notFound } from 'next/navigation';
import { formatSaoPaulo } from '@/shared/lib/time';
import {
  requireActivePerson,
  canApproveCredentialClaim,
  listPendingCredentialClaims,
  CredentialClaimReview,
} from '@/modules/identity';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

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
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Reivindicações de credencial</h1>
        <p className="mt-1 text-sm text-gray-600">
          Solicitações pendentes de ativação de credencial. Confirme a verificação de identidade
          pelo canal seguro definido (telefone/videochamada) antes de ativar. Toda confirmação fica
          registrada na auditoria com o seu nome, o meio utilizado e a data/hora.
        </p>
      </header>

      <CredentialClaimReview items={items} />
    </main>
  );
}
