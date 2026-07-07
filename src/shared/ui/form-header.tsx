/**
 * Fundação de Design System da Fase 1 (T7, DS-11 parcial). Mapeia
 * `.form-header` (+h1/p) do protótipo (L523-525): centralizado, h1
 * `font-heading`.
 */
export interface FormHeaderProps {
  title: string;
  description?: string;
}

export function FormHeader({ title, description }: FormHeaderProps) {
  return (
    <div className="mb-8 text-center">
      <h1 className="mb-2 font-heading text-[2rem] font-extrabold text-fg">{title}</h1>
      {description ? <p className="text-fg-muted">{description}</p> : null}
    </div>
  );
}
