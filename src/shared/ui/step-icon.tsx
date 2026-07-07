import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

/**
 * Fundação de Design System da Fase 1 (T7, DS-08). Mapeia `.step-icon`
 * (+`-blue/-orange/-green`) do protótipo (L352-360, combinações dark
 * L102-104).
 *
 * O protótipo usa fundos pastel com hex cru distinto por tema
 * (`#DBEAFE`/`rgba(59,130,246,0.15)`…) — fora do conjunto de tokens da
 * fundação. Para manter DS-MN-02 (sem hex/paleta fixa) e ainda reagir ao
 * tema automaticamente (sem `dark:`), o tint é derivado via `color-mix()`
 * sobre o próprio token de cor (`--color-primary`/`--color-cta`/
 * `--color-success`) — nenhum valor hex/rgba cru no arquivo.
 */
const stepIconVariants = cva(
  'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg text-2xl',
  {
    variants: {
      variant: {
        blue: 'bg-[color-mix(in_srgb,var(--color-primary)_15%,transparent)] text-primary',
        orange: 'bg-[color-mix(in_srgb,var(--color-cta)_15%,transparent)] text-cta',
        green: 'bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-success',
      },
    },
    defaultVariants: {
      variant: 'blue',
    },
  },
);

export interface StepIconProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof stepIconVariants> {}

export function StepIcon({ className, variant, children, ...props }: StepIconProps) {
  return (
    <div className={cn(stepIconVariants({ variant }), className)} {...props}>
      {children}
    </div>
  );
}
