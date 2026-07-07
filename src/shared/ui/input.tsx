import { forwardRef } from 'react';
import { cn } from './cn';

/**
 * Fundação de Design System da Fase 1 (T5, DS-07). Mapeia
 * `.input-group input` do protótipo: borda 1.5px `--color-border`,
 * `--radius-sm`, foco com anel `--color-primary`. `forwardRef` + spread de
 * props nativos → compatível com `react-hook-form register()` (DS-19).
 */
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg transition-colors placeholder:text-fg-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
