import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Fundação de Design System da Fase 1 (DS-05 parcial). Mescla classes Tailwind
 * via `clsx` (condicionais) + `tailwind-merge` (dedup de conflitos, ex.:
 * `cn('p-2', 'p-4') === 'p-4'`). Utilitário exclusivo de `src/shared/ui/**`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
