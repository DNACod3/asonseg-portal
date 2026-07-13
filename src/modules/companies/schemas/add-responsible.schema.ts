import { z } from 'zod';
import { classifyIdentifier } from '../domain/responsible-identifier';
import type { ResponsibleIdentifier } from '../domain/responsible-identifier';

// Relocado (USP-055 / EMP-8) para `domain/responsible-identifier.ts` — client-safe,
// sem importar o barrel `@/modules/identity` (hazard AD-019). Re-exportado aqui para
// back-compat: o barrel `companies/index.ts` e os testes que importam deste schema
// seguem válidos sem alteração.
export { classifyIdentifier };
export type { ResponsibleIdentifier };

export const addResponsibleSchema = z.object({
  empresaId: z.string().uuid('Empresa inválida.'),
  cpfOuEmail: z
    .string()
    .min(1, 'Informe um CPF ou e-mail.')
    .refine((v) => classifyIdentifier(v) !== null, 'Informe um CPF ou e-mail válido.'),
});

export type AddResponsibleInput = z.input<typeof addResponsibleSchema>;
export type AddResponsibleData = z.output<typeof addResponsibleSchema>;
