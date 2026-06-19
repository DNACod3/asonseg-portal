/**
 * Itens da checklist de verificação de Empresa (USP-017 / P-001 / R3).
 *
 * O **mecanismo** (apresentar a checklist e bloquear a aprovação até todos os
 * itens serem marcados ou dispensados com motivo) é desta USP e está resolvido.
 * O **conteúdo** definitivo dos itens é entregável da Fase 0 (D-001 / AC-111-2,
 * `seed-taxonomia-checklists`) e é gate de PRODUÇÃO (sponsor + coordenador + PO).
 *
 * Estes itens default ficam concentrados aqui (fonte única configurável), nunca
 * embutidos no JSX — para que a troca pelo conteúdo seedado da Fase 0 seja local
 * e não exija mexer na UI.
 */
export interface VerificationChecklistItem {
  id: string;
  label: string;
}

export const VERIFICATION_CHECKLIST_ITEMS: readonly VerificationChecklistItem[] = [
  { id: 'cnpj-ativo', label: 'CNPJ existe e está ativo (consulta manual à Receita/cartão CNPJ).' },
  { id: 'razao-confere', label: 'Razão social confere com o CNPJ informado.' },
  { id: 'endereco-plausivel', label: 'Endereço é plausível e compatível com a atividade declarada.' },
  { id: 'sem-indicios-fantasma', label: 'Sem indícios de empresa-fantasma (dados consistentes entre si).' },
] as const;
