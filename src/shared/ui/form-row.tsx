import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * Fundação de Design System da Fase 1 (T8, DS-09). Mapeia `.form-row`
 * (+`.form-row-3`) e a media query de colapso mobile (protótipo L542-543,
 * L682: `max-width: 768px` → `grid-cols-1`, que coincide com o breakpoint
 * `md` default do Tailwind).
 */
export interface FormRowProps extends HTMLAttributes<HTMLDivElement> {
  cols?: 2 | 3;
}

export const FormRow = forwardRef<HTMLDivElement, FormRowProps>(
  ({ className, cols = 2, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'grid grid-cols-1 gap-4',
        cols === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2',
        className,
      )}
      {...props}
    />
  ),
);
FormRow.displayName = 'FormRow';
