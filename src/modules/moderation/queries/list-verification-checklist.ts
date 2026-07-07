import { prisma } from '@/shared/lib/prisma';
import {
  VERIFICATION_CHECKLIST_ITEMS,
  type VerificationChecklistItem,
} from '../domain/verification-checklist';

/**
 * Itens da checklist de verificação de Empresa a partir da fonte seedável
 * (F0B-01 / B-004 — Fase 0 — Fundação). Lê `verification_checklist_items`
 * (ativos, ordenados por `order`) e mapeia para o shape consumido pelo
 * `VerificationPanel` (`{ id, label }`, `code` vira `id` — mesma chave estável
 * que a const default já usava, ex.: `'cnpj-ativo'`).
 *
 * **Fallback**: se a tabela ainda não foi seedada (vazio), retorna a const
 * `VERIFICATION_CHECKLIST_ITEMS` — o moderador nunca vê uma checklist vazia.
 */
export async function listVerificationChecklistItems(): Promise<VerificationChecklistItem[]> {
  const rows = await prisma.verificationChecklistItem.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    select: { code: true, label: true },
    take: 200, // Paginação defensiva (convenção Prisma) — tabela de referência pequena.
  });

  if (rows.length === 0) {
    return [...VERIFICATION_CHECKLIST_ITEMS];
  }

  return rows.map((row) => ({ id: row.code, label: row.label }));
}
