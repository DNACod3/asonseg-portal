import { prisma } from '@/shared/lib/prisma';

/**
 * Visão de uma Pessoa para um operador institucional (coordenador/diretoria) na
 * tela de gestão/inativação (USP-007). View Model de privacidade (CLAUDE.md):
 * molda os campos visíveis ao papel do observador. Expõe apenas o operacional —
 * nome, status, papéis ativos e os metadados de inativação — **sem** dados
 * sensíveis da ficha social (USP-036, visibilidade restrita / P-006). Não decide
 * permissão (isso é da rota e da Server Action); só controla os campos.
 */
export interface StaffPersonView {
  id: string;
  fullName: string;
  status: 'ATIVO' | 'INATIVO';
  /** Papéis ATIVOS — usados pela UI (ex.: rótulo "Voluntário") e pela política de inativação. */
  roles: string[];
  /** ISO 8601, quando já inativa. */
  inactivatedAt: string | null;
  inactivationReason: string | null;
}

export async function viewPersonForStaff(personId: string): Promise<StaffPersonView | null> {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: {
      id: true,
      fullName: true,
      status: true,
      inactivatedAt: true,
      inactivationReason: true,
      roleGrants: { where: { status: 'ACTIVE' }, select: { role: true }, take: 50 },
    },
  });
  if (!person) return null;

  return {
    id: person.id,
    fullName: person.fullName,
    status: person.status,
    roles: person.roleGrants.map((g) => g.role),
    inactivatedAt: person.inactivatedAt?.toISOString() ?? null,
    inactivationReason: person.inactivationReason,
  };
}

/**
 * Resolve nomes de várias Pessoas em lote para exibição a um operador
 * institucional (staff), em **uma única** consulta (evita N+1). View Model de
 * privacidade (CLAUDE.md / ADR-0010): expõe apenas `id → fullName`, nada da
 * ficha social. Usado por telas de staff que listam Pessoas por id — ex.: a fila
 * de moderação (USP-016) precisa do nome do autor sem ler `Person` direto.
 * Retorna um `Map` para lookup O(1); ids inexistentes simplesmente não aparecem.
 */
export async function viewStaffPersonNames(
  personIds: readonly string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(personIds)];
  if (ids.length === 0) return new Map();

  const persons = await prisma.person.findMany({
    where: { id: { in: ids } },
    select: { id: true, fullName: true },
    take: ids.length,
  });

  return new Map(persons.map((p) => [p.id, p.fullName]));
}
