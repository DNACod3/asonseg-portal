import { cache } from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/shared/lib/prisma';
import { createSupabaseServerClient } from '@/shared/lib/supabase/server';

/**
 * Revalidação de sessão por request (USP-004 — T-08, ADR-0030).
 *
 * Helper de **sessão** (não confundir com o `requirePermission()` do passo 2 da
 * sequência de Server Action sensível, que checa permissões RBAC delegadas —
 * ADR-0001, a criar em USP-007+). Aqui apenas resolvemos a Pessoa autenticada e
 * revalidamos seu `status`.
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
  /** Campos de perfil no nível da Pessoa (mínimo LGPD) — usados, p.ex., para
   *  decidir os campos faltantes ao ativar um papel adicional (USP-006 / E-001). */
  phone: string | null;
  fullAddress: string | null;
}

/**
 * Retorna a Pessoa autenticada (revalidando status no DB) ou `null` se não há
 * sessão / a Pessoa não existe / está inativa. Não redireciona — para checagens
 * condicionais. Para confinar uma rota, use {@link requireActivePerson}.
 *
 * Envolvida em `cache()` de `'react'` (padrão App Router de dedupe por
 * render): `(app)/layout.tsx` e a `page.tsx` de cada rota chamam este helper
 * de forma independente, e sem cache pagariam a query de Auth + Prisma em
 * dobro na mesma request. `cache()` dedupe por identidade dos argumentos
 * dentro da mesma árvore de render RSC; fora de uma render real (ex.: testes
 * unitários chamando a função diretamente), apenas executa sem memoizar — não
 * há efeito colateral fora do contexto de request.
 */
export const getCurrentPerson = cache(async function getCurrentPerson(): Promise<CurrentPerson | null> {
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
      phone: true,
      fullAddress: true,
      credential: { select: { primeiroAcesso: true } },
      // Paginação defensiva (convenção Prisma `take`): este helper roda no
      // layout `(app)` a cada request autenticada; nenhuma Pessoa terá dezenas
      // de papéis ativos, mas o `take` evita carregar coleção ilimitada no hot path.
      roleGrants: { where: { status: 'ACTIVE' }, select: { role: true }, take: 50 },
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
    phone: person.phone,
    fullAddress: person.fullAddress,
  };
});

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
