import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/shared/env';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Piso de segurança do cookie de sessão (H5, Fase 6 — hardening; must-not
 * MN-H5): preenche `httpOnly`/`secure`/`sameSite` quando ausentes, SEM
 * rebaixar o que o `@supabase/ssr` já define (`??` — nunca sobrescreve um
 * valor explícito vindo do upstream). O `@supabase/ssr` já emite
 * HttpOnly/Secure/Lax para o cookie `sb-*-auth-token` por padrão — este
 * helper é uma rede de segurança contra regressão silenciosa do default,
 * não um override.
 *
 * SPEC_DEVIATION (design.md §H5 tinha só `sameSite: options?.sameSite ?? 'lax'`):
 * um `??` puro preserva um `sameSite: 'none'` explícito vindo do upstream —
 * o que tornaria o must-not MN-H5 ("cookie não pode ser emitido ... com
 * SameSite: 'none'") inteiramente furável e o teste que o prova (T12)
 * incondicionalmente vermelho, já que ele injeta exatamente esse valor.
 * `'none'` é o valor MENOS seguro de `sameSite` (cross-site) — normalizá-lo
 * para `'lax'` é elevar o piso, não "rebaixar" (rebaixar seria o inverso:
 * enfraquecer `'strict'`/`'lax'` já definidos, o que este helper não faz).
 */
export function secureCookieOptions(
  options: CookieOptions | undefined,
  { isProd: prod }: { isProd: boolean },
): CookieOptions {
  const sameSite = options?.sameSite === 'none' ? 'lax' : (options?.sameSite ?? 'lax');
  return {
    ...options,
    httpOnly: options?.httpOnly ?? true,
    secure: options?.secure ?? prod,
    sameSite,
  };
}

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
              cookieStore.set(name, value, secureCookieOptions(options, { isProd }));
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
