import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/shared/env';

/**
 * Client Supabase para uso no servidor (Server Components, Server Actions, Route Handlers).
 * Lê/escreve a sessão via cookies do Next. Use SEMPRE em contexto server-side.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `setAll` chamado de um Server Component — ignorável quando há middleware
            // de refresh de sessão cuidando da renovação dos cookies.
          }
        },
      },
    },
  );
}

/**
 * Client com a service role key — ignora qualquer restrição e NUNCA deve ser
 * exposto ao browser. Usar apenas em operações administrativas no servidor.
 */
export function createSupabaseAdminClient() {
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    },
  );
}
