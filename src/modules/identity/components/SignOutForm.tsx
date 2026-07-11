import { Button } from '@/shared/ui';
import { signOutAction } from '../actions/signOut';

/**
 * Botão "Sair" (USP-049 — AUTH-3 / LOGOUT-03). Server Component: form que
 * submete `signOutAction` — sem `'use client'`, sem estado local necessário
 * (precedente: `cadastro/consentimento/page.tsx`, `<form action={serverAction}>`).
 */
export function SignOutForm() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="outline">
        Sair
      </Button>
    </form>
  );
}
