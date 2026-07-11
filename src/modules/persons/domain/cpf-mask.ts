/**
 * Máscara de CPF para exibição ao próprio titular (USP-049 — PERFIL-01).
 *
 * O público-alvo usa computador compartilhado (mesma justificativa do logout,
 * AUTH-3) — a tela `/perfil` mostra o CPF revelando só os 2 últimos dígitos
 * (`***.***.***-NN`) para reduzir shoulder-surfing. Entrada malformada nunca
 * vaza dígitos (fallback neutro). Precedente de formatador puro:
 * `src/modules/companies/domain/cnpj.ts`.
 */

const CPF_MASK_NEUTRAL = '***.***.***-**';

/** Remove máscara/separadores e retorna somente os dígitos. */
function onlyDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Mascara um CPF revelando só os 2 últimos dígitos. Aceita CPF com ou sem
 * pontuação (normaliza internamente). Entrada que não resolve a exatos 11
 * dígitos retorna a máscara neutra `***.***.***-**` (nunca vaza dígitos).
 */
export function maskCpf(raw: string): string {
  const digits = onlyDigits(raw);
  if (digits.length !== 11) return CPF_MASK_NEUTRAL;
  return `***.***.***-${digits.slice(9)}`;
}
