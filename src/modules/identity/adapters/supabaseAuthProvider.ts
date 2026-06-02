import { createSupabaseServerClient } from '@/shared/lib/supabase/server';
import type { AuthProvider, AuthSignInResult } from '../ports/authProvider';

/**
 * Adapter Supabase Auth da porta {@link AuthProvider} (USP-004 — T-05).
 *
 * Usa o client SSR (`@supabase/ssr`), que persiste/limpa o cookie de sessão
 * HttpOnly automaticamente. O hash de senha (bcrypt, cost 10) é gerenciado pelo
 * Supabase — a senha em claro nunca transita fora desta chamada (P-002/P-003).
 *
 * O Supabase devolve o mesmo erro genérico para e-mail inexistente e senha
 * errada (anti-enumeração); por isso o retorno de falha não carrega motivo
 * (ver `loginAction` para a inferência via base de Pessoas — design.md §D-G).
 */
export class SupabaseAuthProvider implements AuthProvider {
  async signInWithPassword(email: string, senha: string): Promise<AuthSignInResult> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error || !data.user) {
      return { ok: false };
    }
    return { ok: true, userId: data.user.id };
  }

  async signOut(): Promise<void> {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
}
