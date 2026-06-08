import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import {
  hasInactivationPrivilege,
  hasReactivationPrivilege,
  viewPersonForStaff,
  InactivatePersonDialog,
  ReactivatePersonDialog,
} from '@/modules/persons';
import { formatSaoPaulo } from '@/shared/lib/time';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

/** Rótulos PT-BR dos papéis exibidos a operadores institucionais. */
const ROLE_LABELS: Record<string, string> = {
  CANDIDATE: 'Candidato(a)',
  PROVIDER: 'Prestador(a)',
  CLIENT: 'Cliente',
  COMPANY_RESPONSIBLE: 'Responsável de Empresa',
  VOLUNTEER: 'Voluntário(a)',
  COORDINATOR: 'Coordenador(a)',
  SOCIAL_ASSISTANT: 'Assistente social',
  BOARD: 'Diretoria',
};

/**
 * Tela de gestão de uma Pessoa para coordenador/diretoria (USP-007 / USP-045).
 *
 * Restrita por papel: a sessão é revalidada pelo layout `(app)` (ADR-0030) e aqui
 * filtramos por privilégio de inativação/reativação (coordenador/diretoria). Quem
 * não tem permissão recebe 404 — a rota não revela sua existência. A decisão fina
 * (hierarquia de rank vs. inativador, zeragem de grants) fica na Server Action
 * (defesa em profundidade).
 */
export default async function PessoaPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireActivePerson();
  if (!hasInactivationPrivilege(viewer.roles)) {
    notFound();
  }

  const { id } = await params;
  const person = await viewPersonForStaff(id);
  if (!person) {
    notFound();
  }

  const isSelf = person.id === viewer.id;
  const roleLabels = person.roles.map((r) => ROLE_LABELS[r] ?? r);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{person.fullName}</h1>
          <span
            className={
              person.status === 'ATIVO'
                ? 'rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800'
                : 'rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700'
            }
          >
            {person.status === 'ATIVO' ? 'Ativa' : 'Inativa'}
          </span>
        </div>
        {roleLabels.length > 0 && (
          <p className="text-sm text-gray-600">Papéis: {roleLabels.join(', ')}</p>
        )}
      </header>

      {person.status === 'ATIVO' ? (
        <section className="flex flex-col gap-3 rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900">Inativar acesso</h2>
          {isSelf ? (
            <p className="text-sm text-amber-700">
              Você não pode inativar a si mesmo(a). Peça a outro responsável para fazê-lo.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Bloqueia novos acessos preservando todo o histórico. Se a Pessoa for a única
                responsável por uma Empresa, designe outro responsável antes de inativá-la.
              </p>
              <InactivatePersonDialog personId={person.id} personName={person.fullName} />
            </>
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-5">
          <h2 className="text-base font-semibold text-gray-900">Pessoa inativa</h2>
          {person.inactivatedAt && (
            <p className="text-sm text-gray-600">
              Inativada em {formatSaoPaulo(new Date(person.inactivatedAt), 'dd/MM/yyyy HH:mm')}.
            </p>
          )}
          {person.inactivationReason && (
            <p className="text-sm text-gray-600">Motivo: {person.inactivationReason}</p>
          )}
          <p className="text-xs text-gray-500">
            O histórico operacional permanece preservado e visível para quem tem permissão.
          </p>
          {hasReactivationPrivilege(viewer.roles) && (
            <>
              <p className="text-sm text-gray-600">
                Para reverter a inativação, use o botão abaixo. Os papéis e permissões anteriores
                não serão restaurados automaticamente — precisarão ser reconcedidos após a
                reativação (USP-008).
              </p>
              <ReactivatePersonDialog personId={person.id} personName={person.fullName} />
            </>
          )}
        </section>
      )}
    </main>
  );
}
