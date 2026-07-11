/**
 * Rótulos PT-BR canônicos de **todos** os papéis do portal (USP-049 —
 * PERFIL-01), para a tela `/perfil` do titular.
 *
 * SPEC_DEVIATION: o design (`design.md`) nomeia este mapa `ROLE_LABELS`, mas o
 * barrel `identity/index.ts` já reexporta um `ROLE_LABELS` de
 * `role-activation.ts` — escopado só aos 3 `PublicRole` (CANDIDATE/PROVIDER/
 * CLIENT), usado em mensagens de erro de ativação de papel adicional
 * (USP-006). Um segundo export com o mesmo nome colidiria no barrel. Nomeado
 * aqui `ALL_ROLE_LABELS` para distinguir explicitamente o escopo (8 papéis)
 * sem tocar o mapa existente (fora de escopo desta USP — ver spec.md "Out of
 * Scope": consolidação de rótulos é USP-059/SOC-4).
 *
 * Reason: evitar colisão de nome no barrel sem alterar comportamento
 * existente de `role-activation.ts`.
 *
 * Valores idênticos ao mapa inline de `pessoas/[id]/page.tsx:17-26`
 * (consolidação futura → USP-059).
 */
export const ALL_ROLE_LABELS: Record<string, string> = {
  CANDIDATE: 'Candidato(a)',
  PROVIDER: 'Prestador(a)',
  CLIENT: 'Cliente',
  COMPANY_RESPONSIBLE: 'Responsável de Empresa',
  VOLUNTEER: 'Voluntário(a)',
  COORDINATOR: 'Coordenador(a)',
  SOCIAL_ASSISTANT: 'Assistente social',
  BOARD: 'Diretoria',
};
