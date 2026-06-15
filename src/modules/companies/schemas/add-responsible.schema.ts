import { z } from 'zod';
import { isValidCpf } from '@/modules/identity';

/**
 * Identificador de busca da Pessoa a adicionar: CPF (somente dígitos) ou e-mail.
 * Discrimina por presença de "@". Retorna o valor normalizado para a consulta
 * (CPF só dígitos; e-mail lowercase+trim) ou `null` se não for CPF nem e-mail válido.
 */
export type ResponsibleIdentifier =
  | { kind: 'cpf'; value: string }
  | { kind: 'email'; value: string };

export function classifyIdentifier(raw: string): ResponsibleIdentifier | null {
  const trimmed = raw.trim();
  if (trimmed.includes('@')) {
    const email = trimmed.toLowerCase();
    return z.string().email().safeParse(email).success ? { kind: 'email', value: email } : null;
  }
  const digits = trimmed.replace(/\D/g, '');
  return isValidCpf(digits) ? { kind: 'cpf', value: digits } : null;
}

export const addResponsibleSchema = z.object({
  empresaId: z.string().uuid('Empresa inválida.'),
  cpfOuEmail: z
    .string()
    .min(1, 'Informe um CPF ou e-mail.')
    .refine((v) => classifyIdentifier(v) !== null, 'Informe um CPF ou e-mail válido.'),
});

export type AddResponsibleInput = z.input<typeof addResponsibleSchema>;
export type AddResponsibleData = z.output<typeof addResponsibleSchema>;
