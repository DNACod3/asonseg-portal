import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * Fundação de Design System da Fase 1 (T6, DS-11 parcial). `FormCard` mapeia
 * `.form-card` do protótipo (L527-534): superfície, `rounded-lg`, `p-8`,
 * `shadow-sm`. `FormSectionTitle` mapeia `.form-section-title` (L535-540):
 * `font-heading`, borda inferior.
 *
 * Simplificação vs. protótipo: a borda inferior do título usa o token
 * `border-border` (que já coincide com o valor dark do protótipo) em vez do
 * hex cru do light do protótipo — evita hex fora de token (DS-MN-02) com
 * diferença visual desprezível.
 */
export const FormCard = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('mb-6 rounded-lg border border-border bg-surface p-8 shadow-sm', className)}
      {...props}
    />
  ),
);
FormCard.displayName = 'FormCard';

export const FormSectionTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn(
        'mb-4 border-b-2 border-border pb-2 font-heading text-[1.1rem] font-bold text-fg',
        className,
      )}
      {...props}
    />
  ),
);
FormSectionTitle.displayName = 'FormSectionTitle';
