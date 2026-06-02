import { redirect } from 'next/navigation';
import { prisma } from '@/shared/lib/prisma';
import { createSupabaseServerClient } from '@/shared/lib/supabase/server';

/**
 * Revalidação de sessão por request (USP-004 — T-08, ADR-0030).
 *
 * **Nota de arquitetura (SPEC_DEVIATION leve):** o `design.md §D-E` previa a
 * checagem de `Person.status` dentro do `middleware.ts`. O middleware roda no
 * Edge Runtime, onde o Prisma (driver TCP) não roda; por isso a revalidação
 * autoritativa fica neste helper, executado em **todo** Server Component/Action
 * autenticado (runtime Node). O middleware mantém apenas o gate barato de
 * presença de sessão (redirect a `/login` se não houver cookie). O efeito é o
 * mesmo exigido pela ADR-0030 — uma Pessoa inativada perde acesso na próxima
 * request — apenas movido da borda para a camada de aplicação.
 */

export interface CurrentPerson {
  id: string;
  supabaseUserId: string;
  fullName: string;
  status: 'ATIVO' | 'INATIVO';
  primeiroAcesso: boolean;
  roles: string[];
}

/**
 * Retorna a Pessoa autenticada (revalidando status no DB) ou `null` se não há
 * sessão / a Pessoa não existe / está inativa. Não redireciona — para checagens
 * condicionais. Para confinar uma rota, use {@link requireActivePerson}.
 */
export async function getCurrentPerson(): Promise<CurrentPerson | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const person = await prisma.person.findUnique({
    where: { supabaseUserId: user.id },
    select: {
      id: true,
      fullName: true,
      status: true,
      supabaseUserId: true,
      credential: { select: { primeiroAcesso: true } },
      roleGrants: { where: { status: 'ACTIVE' }, select: { role: true } },
    },
  });

  // Pessoa inexistente ou inativa: sessão não confere mais acesso (ADR-0030).
  if (!person || person.status !== 'ATIVO' || !person.supabaseUserId) return null;

  return {
    id: person.id,
    supabaseUserId: person.supabaseUserId,
    fullName: person.fullName,
    status: person.status,
    primeiroAcesso: person.credential?.primeiroAcesso ?? false,
    roles: person.roleGrants.map((g) => g.role),
  };
}

/**
 * Confina uma rota `(app)/*`: exige sessão + Pessoa ATIVA. Redireciona a
 * `/login` quando não autenticado/inativo e a `/trocar-senha` enquanto a
 * credencial estiver em 1º acesso (D-F) — exceto na própria página de troca.
 */
export async function requireActivePerson(
  opts: { allowFirstAccess?: boolean } = {},
): Promise<CurrentPerson> {
  const person = await getCurrentPerson();
  if (!person) redirect('/login');
  if (person.primeiroAcesso && !opts.allowFirstAccess) redirect('/trocar-senha');
  return person;
}
