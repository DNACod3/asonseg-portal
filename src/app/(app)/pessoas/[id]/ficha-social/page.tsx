import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import {
  canManageSocioeconomicRecord,
  viewPersonForStaff,
  getSocioeconomicRecord,
  SocioeconomicRecordForm,
} from '@/modules/persons';
import { FormHeader } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

/**
 * Ficha socioeconômica de uma Pessoa (USP-036 / SOC-01, SOC-02).
 *
 * SPEC_DEVIATION: design.md propunha `social/pessoas/[personId]/ficha`. Reason:
 * `(app)/pessoas/[id]` já é a área de gestão institucional de uma Pessoa (USP-007/
 * USP-045 — inativar/reativar), com o mesmo público (coordenador/diretoria/AS).
 * Nesta-la como `pessoas/[id]/ficha-social` reusa a convenção de rota já
 * estabelecida em vez de abrir um prefixo `social/` novo — exatamente a ressalva
 * que o próprio design.md previu ("ajustar à convenção... se já houver área AS").
 *
 * Restrita por papel: a sessão é revalidada pelo layout `(app)` (ADR-0030) e aqui
 * filtramos por `canManageSocioeconomicRecord` (SOCIAL_ASSISTANT/BOARD — SOC-036-MN-01
 * na rota). Quem não tem permissão recebe 404 — a rota não revela sua existência
 * nem renderiza nenhum campo da ficha. `getSocioeconomicRecord` repete a mesma
 * guarda internamente (defesa em profundidade) e é a fonte da auditoria de leitura.
 */
export default async function FichaSocialPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireActivePerson();
  if (!canManageSocioeconomicRecord(viewer.roles)) {
    notFound();
  }

  const { id } = await params;
  const person = await viewPersonForStaff(id);
  if (!person) {
    notFound();
  }

  const res = await getSocioeconomicRecord(id);
  if (!res.ok) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <FormHeader
        title={`Ficha socioeconômica — ${person.fullName}`}
        description="Registro social mínimo: renda aproximada, benefício social, situação de moradia e composição familiar declarada."
      />
      <SocioeconomicRecordForm personId={id} initial={res.data} />
    </main>
  );
}
