import { revalidatePath } from 'next/cache';

/**
 * Revalidação on-demand dos indicadores da home pública (USP-041 / T6 —
 * E-002 / D-005). `revalidatePath` não é transacional — esta função é
 * chamada **fora** da transação, depois do commit, nos pontos que movem um
 * dos 3 contadores (vaga aprovada → ACTIVE, perfil de candidato ativado →
 * ACTIVE, verificação de Empresa). O piso ISR de 600s (`revalidate` em
 * `app/(public)/page.tsx`, REL41-MN-03) é o backstop de correção caso algum
 * call-site fique de fora — nunca regride o teto de 600s.
 */
export function revalidateHomeIndicators(): void {
  revalidatePath('/');
}
