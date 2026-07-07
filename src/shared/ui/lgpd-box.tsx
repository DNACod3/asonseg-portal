import { type HTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * Fundação de Design System da Fase 1 (T9, DS-11 parcial). Mapeia
 * `.lgpd-box` (+h4/p) do protótipo (L558-577) — só estilo; a semântica de
 * consentimento é preservada pelo consumidor (decisão de produto (b),
 * design.md), que usa `<form action>` + `Button` (aceite afirmativo
 * versionado), não checkbox inline.
 *
 * Simplificação vs. protótipo: o fundo hex cru do protótipo (light e dark)
 * mapeia para o token `bg-background` (light coincide exatamente; dark fica
 * próximo, sem hex cru fora do token — DS-MN-02).
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
