/**
 * Validação de CNPJ (dígitos verificadores — AC-012-2).
 *
 * Normaliza removendo máscara antes de validar (AC edge: "CNPJ com máscara/
 * pontuação deve ser normalizado antes de validar").
 */

/** Remove máscara e retorna somente os 14 dígitos. */
export function normalizeCnpj(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Valida formato e dígitos verificadores de um CNPJ.
 * Normaliza internamente — aceita com ou sem máscara.
 * Retorna `true` se válido.
 */
export function isValidCnpj(cnpj: string): boolean {
  const digits = normalizeCnpj(cnpj);

  if (digits.length !== 14) return false;

  // Rejeita sequências repetidas (ex: 00000000000000)
  if (/^(\d)\1+$/.test(digits)) return false;

  const calcDigit = (base: string, weights: number[]): number => {
    const sum = base
      .split('')
      .reduce((acc, d, i) => acc + parseInt(d, 10) * weights[i]!, 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigit(digits.slice(0, 12), w1);
  if (d1 !== parseInt(digits[12]!, 10)) return false;

  const d2 = calcDigit(digits.slice(0, 13), w2);
  return d2 === parseInt(digits[13]!, 10);
}

/** Formata CNPJ normalizado como XX.XXX.XXX/XXXX-XX para exibição. */
export function formatCnpj(digits: string): string {
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * O erro é uma violação de unicidade de CNPJ (índice `companies_cnpj_key`) numa
 * corrida concorrente? O Prisma 5.x sinaliza via `code === 'P2002'` + `meta.target`
 * (`['cnpj']`); a mensagem **não** carrega o nome do índice, então casar string na
 * mensagem é frágil (e nunca casava) — usamos o código estruturado do erro.
 * Pura (só inspeciona o formato do erro), compartilhada por create/edit (P-005).
 */
export function isCnpjUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Error) || (err as { code?: unknown }).code !== 'P2002') {
    return false;
  }
  const target = (err as { meta?: { target?: unknown } }).meta?.target;
  return Array.isArray(target)
    ? target.includes('cnpj')
    : String(target ?? '').includes('cnpj');
}
