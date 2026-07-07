import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

/**
 * Fundação de Design System da Fase 1 (T4, DS-06). Mapeia `.btn`/
 * `.btn-primary`/`.btn-secondary`/`.btn-outline`/`.btn-sm`/`.btn-lg` do
 * protótipo (`docs/prototipo/index.html` L158-184). Todas as classes
 * resolvem para tokens CSS (`bg-cta`, `border-primary`, `text-fg`…) — nenhum
 * hex cru nem utilitário de paleta fixa (DS-MN-02); a re-resolução de
 * `[data-theme]` cobre o dark mode sem precisar de `dark:` (design.md
 * §Architecture Overview).
 *
 * Simplificação vs. protótipo: `.btn-secondary:hover` no protótipo troca de
 * cor entre light (`--color-primary`) e dark (`--color-secondary`) — aqui
 * mantemos `primary` nos dois temas (já resolve para um azul mais claro no
 * dark), evitando `dark:` extra sem violar nenhum AC do spec.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-sm font-semibold text-[0.95rem] transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        primary: 'bg-cta text-white hover:bg-cta-hover hover:shadow-md',
        secondary:
          'border-2 border-primary bg-transparent text-primary hover:bg-primary hover:text-white',
        outline:
          'border-[1.5px] border-border bg-transparent text-fg hover:border-primary hover:text-primary',
        danger: 'bg-danger text-white hover:shadow-md hover:brightness-95',
      },
      size: {
        sm: 'px-4 py-2 text-[0.85rem]',
        default: 'px-6 py-3',
        lg: 'px-8 py-4 text-[1.05rem]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Renderiza o filho via Radix `Slot` (contrato: um único filho) em vez de `<button>`. */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
    );
  },
);
Button.displayName = 'Button';
