import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

/**
 * Fundação de Design System da Fase 1 (T10, DS-10). Mapeia `.badge`
 * (+`-blue/-orange/-green/-gray`) do protótipo (L186-193, dark L93-96).
 *
 * Mesma estratégia de `StepIcon` (T7) para o tint de fundo: `color-mix()`
 * sobre o token de cor em vez de hex/rgba cru (DS-MN-02) — reage ao tema
 * automaticamente.
 */
const badgeVariants = cva('inline-block rounded-full px-3 py-1 text-xs font-semibold', {
  variants: {
    variant: {
      blue: 'bg-[color-mix(in_srgb,var(--color-primary)_15%,transparent)] text-primary',
      orange: 'bg-[color-mix(in_srgb,var(--color-cta)_15%,transparent)] text-cta',
      green: 'bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-success',
      gray: 'bg-[color-mix(in_srgb,var(--color-text-light)_15%,transparent)] text-fg-muted',
    },
  },
  defaultVariants: {
    variant: 'gray',
  },
});

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
