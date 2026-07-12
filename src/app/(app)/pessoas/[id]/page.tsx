import { notFound } from 'next/navigation';
import { ALL_ROLE_LABELS, requireActivePerson } from '@/modules/identity';
import {
  hasInactivationPrivilege,
  hasReactivationPrivilege,
  viewPersonForStaff,
  InactivatePersonDialog,
  ReactivatePersonDialog,
  PERSON_STATUS_LABELS,
} from '@/modules/persons';
import { Badge, Card } from '@/shared/ui';
import { formatSaoPaulo } from '@/shared/lib/time';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

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
  const roleLabels = person.roles.map((r) => ALL_ROLE_LABELS[r] ?? r);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-bold text-fg">{person.fullName}</h1>
          <Badge variant={person.status === 'ATIVO' ? 'green' : 'gray'}>
            {PERSON_STATUS_LABELS[person.status] ?? person.status}
          </Badge>
        </div>
        {roleLabels.length > 0 && (
          <p className="text-sm text-fg-muted">Papéis: {roleLabels.join(', ')}</p>
        )}
      </header>

      {person.status === 'ATIVO' ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-fg">Inativar acesso</h2>
          {isSelf ? (
            <p className="text-sm text-cta">
              Você não pode inativar a si mesmo(a). Peça a outro responsável para fazê-lo.
            </p>
          ) : (
            <>
              <p className="text-sm text-fg-muted">
                Bloqueia novos acessos preservando todo o histórico. Se a Pessoa for a única
                responsável por uma Empresa, designe outro responsável antes de inativá-la.
              </p>
              <InactivatePersonDialog personId={person.id} personName={person.fullName} />
            </>
          )}
        </Card>
      ) : (
        <Card className="flex flex-col gap-3 bg-background">
          <h2 className="text-base font-semibold text-fg">Pessoa inativa</h2>
          {person.inactivatedAt && (
            <p className="text-sm text-fg-muted">
              Inativada em {formatSaoPaulo(new Date(person.inactivatedAt), 'dd/MM/yyyy HH:mm')}.
            </p>
          )}
          {person.inactivationReason && (
            <p className="text-sm text-fg-muted">Motivo: {person.inactivationReason}</p>
          )}
          <p className="text-xs text-fg-muted">
            O histórico operacional permanece preservado e visível para quem tem permissão.
          </p>
          {hasReactivationPrivilege(viewer.roles) && (
            <>
              <p className="text-sm text-fg-muted">
                Para reverter a inativação, use o botão abaixo. Os papéis e permissões anteriores
                não serão restaurados automaticamente — precisarão ser reconcedidos após a
                reativação (USP-008).
              </p>
              <ReactivatePersonDialog personId={person.id} personName={person.fullName} />
            </>
          )}
        </Card>
      )}
    </main>
  );
}
