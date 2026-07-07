import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from './cn';

/**
 * Fundação de Design System da Fase 1 (T5, DS-07). Mapeia
 * `.input-group label` do protótipo sobre `@radix-ui/react-label` (a11y —
 * `htmlFor`/associação nativa).
 */
export const Label = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('mb-1 block text-sm font-medium text-fg', className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;
