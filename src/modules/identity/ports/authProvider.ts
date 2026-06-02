import { createToken } from '@/shared/container';

/**
 * Resultado de uma autenticação por senha.
 *
 * O provedor (Supabase Auth) **não distingue** "e-mail inexistente" de "senha
 * errada" — por design anti-enumeração, devolve o mesmo erro genérico. Portanto
 * o port expõe apenas sucesso (com o `userId`) ou falha sem motivo. A razão da
 * falha (`unknown_email` x `wrong_password`) é inferida pela `loginAction`
 * consultando a própria base de Pessoas (design.md §D-G).
 */
export type AuthSignInResult =
  | { readonly ok: true; readonly userId: string }
  | { readonly ok: false };

/**
 * Porta de autenticação (USP-004 — T-05, ADR-0010). Isola o provedor concreto
 * (Supabase Auth) do domínio; consumidores dependem desta interface e resolvem
 * o adapter via `container.ts`. Trocar de provedor não toca a `loginAction`.
 */
export interface AuthProvider {
  /** Autentica por e-mail/senha. Como efeito colateral, o adapter de produção
   *  grava o cookie de sessão (SSR). Em sucesso, retorna o `userId` do provedor. */
  signInWithPassword(email: string, senha: string): Promise<AuthSignInResult>;
  /** Encerra a sessão atual (limpa cookies). Usado quando a Pessoa autenticou
   *  mas está INATIVA — não se deve manter sessão de quem não pode operar. */
  signOut(): Promise<void>;
}

export const AUTH_PROVIDER_TOKEN = createToken<AuthProvider>('AuthProvider');
