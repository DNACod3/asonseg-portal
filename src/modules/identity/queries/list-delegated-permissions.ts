import { prisma } from '@/shared/lib/prisma';
import type { PermissionId } from '@prisma/client';

export interface VolunteerWithPermissions {
  personId: string;
  fullName: string;
  grants: Array<{
    id: string;
    permission: PermissionId;
    scopeArea: string | null;
    grantedAt: Date;
  }>;
}

/**
 * Lista voluntários com permissões delegadas ativas, ordenados por nome.
 * Visível apenas para coordenadores — a rota `(app)` faz o gate.
 */
export async function listDelegatedPermissions(): Promise<VolunteerWithPermissions[]> {
  const grants = await prisma.delegatedPermission.findMany({
    where: { revokedAt: null },
    orderBy: [{ person: { fullName: 'asc' } }, { grantedAt: 'asc' }],
    take: 200,
    select: {
      id: true,
      permission: true,
      scopeArea: true,
      grantedAt: true,
      person: { select: { id: true, fullName: true } },
    },
  });

  // Agrupar por pessoa
  const byPerson = new Map<string, VolunteerWithPermissions>();
  for (const g of grants) {
    const existing = byPerson.get(g.person.id);
    const entry = {
      id: g.id,
      permission: g.permission,
      scopeArea: g.scopeArea,
      grantedAt: g.grantedAt,
    };
    if (existing) {
      existing.grants.push(entry);
    } else {
      byPerson.set(g.person.id, {
        personId: g.person.id,
        fullName: g.person.fullName,
        grants: [entry],
      });
    }
  }

  return Array.from(byPerson.values());
}

/**
 * Lista voluntários elegíveis para receber permissões (VOLUNTEER, ATIVO).
 */
export async function listEligibleVolunteers(): Promise<Array<{ id: string; fullName: string }>> {
  const people = await prisma.person.findMany({
    where: {
      status: 'ATIVO',
      roleGrants: { some: { role: 'VOLUNTEER', status: 'ACTIVE' } },
    },
    orderBy: { fullName: 'asc' },
    take: 200,
    select: { id: true, fullName: true },
  });
  return people;
}
