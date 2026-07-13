import { prisma } from '@/shared/lib/prisma';
import { maskCpf } from '../domain/cpf-mask';

/**
 * View Model do **próprio** titular para a tela `/perfil` (USP-049 — AUTH-4 /
 * PERFIL-01, PERFIL-03). Diferente dos View Models existentes (staff/employer/
 * search), que removem CPF/e-mail estruturalmente para observadores externos,
 * este é o único View Model **self** — o titular pode ver os próprios dados
 * (CLAUDE.md §Privacy: acesso direto ao Prisma é permitido só para dados
 * próprios).
 *
 * **PERFIL-MN-01**: recebe só o `personId` — sem parâmetro de terceiro. O
 * chamador (página `/perfil`) DEVE passar exclusivamente o `person.id` da
 * sessão resolvida por `requireActivePerson()`; esta função não tem meios de
 * decidir "de quem" além do id recebido — a garantia de "sempre o próprio"
 * vive no chamador, não aqui.
 */
export interface SelfProfileView {
  fullName: string;
  emailLogin: string;
  cpfMasked: string;
  /** Papéis com `roleGrant` **ATIVO** — PERFIL-03 (nunca revogado/pendente). */
  roles: string[];
}

export async function viewPersonForSelf(personId: string): Promise<SelfProfileView | null> {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: {
      fullName: true,
      emailLogin: true,
      cpf: true,
      roleGrants: { where: { status: 'ACTIVE' }, select: { role: true }, take: 50 },
    },
  });
  if (!person) return null;

  return {
    fullName: person.fullName,
    emailLogin: person.emailLogin ?? '',
    cpfMasked: maskCpf(person.cpf ?? ''),
    roles: person.roleGrants.map((g) => g.role),
  };
}
