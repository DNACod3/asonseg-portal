'use server';

import { redirect } from 'next/navigation';
import { getCurrentPerson } from '../server/session';
import { createSupabaseServerClient } from '@/shared/lib/supabase/server';

/**
 * Server Action de logout (USP-049 — AUTH-3 / LOGOUT-01, LOGOUT-02).
 *
 * Encerra a sessão no provedor (`supabase.auth.signOut()`) e redireciona a
 * `/login`. Chama `getCurrentPerson()` como gate de sessão — satisfaz o guard
 * estático H3 (toda `'use server'` action exige gate) — e é **idempotente**:
 * mesmo sem sessão ativa (`getCurrentPerson()` → `null`), ainda redireciona
 * (LOGOUT-02), pois o objetivo do usuário ("sair") já está satisfeito.
 *
 * **Sem auditoria** (spec.md — Assumptions): não há `AuditEvent` para logout
 * no catálogo; encerrar sessão não é escrita de domínio (o log de auth do
 * Supabase já registra o sign-out). Deferível como follow-up trivial.
 */
export async function signOutAction(): Promise<void> {
  await getCurrentPerson();

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  redirect('/login');
}
