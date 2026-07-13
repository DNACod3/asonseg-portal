import type { PersonStatus } from '@prisma/client';

/**
 * Rótulos PT-BR de `PersonStatus` (USP-059 — SOC-4). Espelha o literal já
 * usado em `(app)/pessoas/[id]/page.tsx` (ternário `person.status === 'ATIVO'
 * ? 'Ativa' : 'Inativa'`) — nenhuma redação nova. Consumido pelo painel
 * consolidado (T9) e pela própria `pessoas/[id]` (T10, dedup).
 */
export const PERSON_STATUS_LABELS: Record<PersonStatus, string> = {
  ATIVO: 'Ativa',
  INATIVO: 'Inativa',
};
