import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * Fundação de Design System da Fase 1 (T6, DS-11 parcial). Mapeia `.card` do
 * protótipo: superfície + borda + `shadow-sm`, `shadow-md` no hover.
 */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-md border border-border bg-surface p-6 shadow-sm transition-shadow hover:shadow-md',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';
