// Barrel do design system (`src/shared/ui/`). Todos os imports externos aos
// primitivos da fundação devem passar por este arquivo (CLAUDE.md §Import
// rule; DS-05).
export { cn } from './cn';

export { Button, type ButtonProps } from './button';
export { Input } from './input';
export { Label } from './label';
export { Textarea } from './textarea';

export { Card } from './card';
export { FormCard, FormSectionTitle } from './form-card';

export { FormHeader, type FormHeaderProps } from './form-header';
export { StepIcon, type StepIconProps } from './step-icon';

export { FormRow, type FormRowProps } from './form-row';

export { LgpdBox, type LgpdBoxProps, LgpdCheck, type LgpdCheckProps } from './lgpd-box';

export { Badge, type BadgeProps } from './badge';

export { ThemeToggle, type ThemeToggleProps } from './theme-toggle';
export { ThemeScript, THEME_INIT_SCRIPT } from './theme-script';
