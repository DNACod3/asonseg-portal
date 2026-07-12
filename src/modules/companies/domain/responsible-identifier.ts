import { z } from 'zod';

/**
 * Classificação client-safe de "CPF ou e-mail" para a busca de responsável
 * (USP-013 / EMP-8, USP-055). Relocado de `schemas/add-responsible.schema.ts`
 * para permitir uso em Client Components sem importar o barrel
 * `@/modules/identity` (que arrasta código server/Prisma para o bundle do
 * client — hazard AD-019). A checagem de dígito verificador de CPF abaixo é
 * uma cópia intencional do algoritmo canônico de
 * `identity/schemas/registerPerson.ts` (mesmo padrão de carve-out client/
 * server usado em `EDUCATION_LEVELS`).
 */

/** Cópia client-safe do algoritmo de validação de dígitos verificadores de CPF. */
function isValidCpfLocal(digits: string): boolean {
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += Number(digits[i]) * (len + 1 - i);
    }
    const rem = (sum * 10) % 11;
    return rem === 10 ? 0 : rem;
  };

  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

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
  return isValidCpfLocal(digits) ? { kind: 'cpf', value: digits } : null;
}
