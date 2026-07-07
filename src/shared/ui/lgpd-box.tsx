import { forwardRef, useId, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

/**
 * Fundação de Design System da Fase 1 (T9, DS-11 parcial). Mapeia
 * `.lgpd-box` (+h4/p) e `.lgpd-check` (+input/span/a) do protótipo (L558-577)
 * — só estilo; a semântica de consentimento é preservada pelo consumidor
 * (decisão de produto (b), design.md).
 *
 * Simplificação vs. protótipo: o fundo `#F8FAFC`/dark `#1A2332` mapeia para
 * o token `bg-background` (light coincide exatamente; dark fica próximo,
 * sem hex cru fora do token — DS-MN-02).
 */
export interface LgpdBoxProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
}

export function LgpdBox({ title, children, className, ...props }: LgpdBoxProps) {
  return (
    <div className={cn('mb-6 rounded-md border border-border bg-background p-6', className)} {...props}>
      <h4 className="mb-2 flex items-center gap-2 text-[0.95rem] font-semibold text-fg">{title}</h4>
      {children}
    </div>
  );
}

export interface LgpdCheckProps extends InputHTMLAttributes<HTMLInputElement> {
  children: ReactNode;
}

export const LgpdCheck = forwardRef<HTMLInputElement, LgpdCheckProps>(
  ({ className, children, id, ...props }, ref) => {
    const generatedId = useId();
    const checkboxId = id ?? generatedId;
    return (
      <label htmlFor={checkboxId} className={cn('flex cursor-pointer items-start gap-2', className)}>
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          className="mt-[3px] h-[18px] w-[18px] cursor-pointer accent-primary"
          {...props}
        />
        <span className="text-[0.85rem] leading-relaxed text-fg">{children}</span>
      </label>
    );
  },
);
LgpdCheck.displayName = 'LgpdCheck';
