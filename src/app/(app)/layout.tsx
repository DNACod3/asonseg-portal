import { requireActivePerson } from '@/modules/identity';

// Route group (app): área autenticada. CLAUDE.md: force-dynamic (dados sensíveis por usuário).
export const dynamic = 'force-dynamic';

/**
 * Confinamento autoritativo das rotas `(app)/*` (USP-004 — T-08, ADR-0030).
 * Revalida a sessão e o status da Pessoa a cada request (runtime Node, onde o
 * Prisma roda) e força a troca de senha no 1º acesso (D-F). O middleware Edge
 * faz apenas o gate barato de presença de cookie.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireActivePerson();
  return <>{children}</>;
}
