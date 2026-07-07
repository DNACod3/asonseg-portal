import { forwardRef } from 'react';
import { cn } from './cn';

/**
 * Fundação de Design System da Fase 1 (T5, DS-07). Mapeia
 * `.input-group textarea` do protótipo (mesma borda/foco do `Input`, com
 * `resize-y` e altura mínima). `forwardRef` compatível com
 * `react-hook-form register()`.
 */
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'min-h-[100px] w-full resize-y rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg transition-colors placeholder:text-fg-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
