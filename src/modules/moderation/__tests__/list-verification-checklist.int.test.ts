// Integração da checklist de verificação como dado seedável (F0B-01 / B-004 —
// Fase 0 — Fundação). Requer Postgres local (`supabase start` + DATABASE_URL).
//
// Garante, contra o DB real:
//  - itens ATIVOS voltam ORDENADOS por `order` quando a tabela tem dados;
//  - fallback para a const `VERIFICATION_CHECKLIST_ITEMS` quando a tabela está
//    vazia (cenário real do CI, que não roda `db:seed` antes da suíte de
//    integração) — o moderador nunca vê uma checklist vazia.
//
// Não usa os `code`s reais do seed (A1..B4): insere/restaura itens próprios
// (prefixo `zz-int-test-`) para não colidir com o dado de produção/dev.

import { describe, expect, it } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import { listVerificationChecklistItems, VERIFICATION_CHECKLIST_ITEMS } from '@/modules/moderation';

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const TEST_CODES = ['zz-int-test-2', 'zz-int-test-1', 'zz-int-test-inactive'] as const;

async function cleanupTestRows(): Promise<void> {
  await prisma.verificationChecklistItem.deleteMany({ where: { code: { in: [...TEST_CODES] } } });
}

skipIfNoDb('listVerificationChecklistItems — integração (F0B-01)', () => {
  it('retorna itens ativos ordenados por `order`, ignorando inativos', async () => {
    await cleanupTestRows();
    try {
      // Ordem de inserção deliberadamente invertida — a query deve reordenar por `order`.
      await prisma.verificationChecklistItem.create({
        data: { code: 'zz-int-test-2', section: 'B', label: 'Segundo item (teste)', order: 200, isActive: true },
      });
      await prisma.verificationChecklistItem.create({
        data: { code: 'zz-int-test-1', section: 'A', label: 'Primeiro item (teste)', order: 100, isActive: true },
      });
      await prisma.verificationChecklistItem.create({
        data: { code: 'zz-int-test-inactive', section: 'B', label: 'Inativo (teste)', order: 150, isActive: false },
      });

      const items = await listVerificationChecklistItems();
      const testItems = items.filter((i) => i.id.startsWith('zz-int-test-'));

      expect(testItems.map((i) => i.id)).toEqual(['zz-int-test-1', 'zz-int-test-2']);
      expect(testItems.map((i) => i.label)).toEqual(['Primeiro item (teste)', 'Segundo item (teste)']);
    } finally {
      await cleanupTestRows();
    }
  });

  it('cai no fallback (const default) quando a tabela está vazia', async () => {
    const existing = await prisma.verificationChecklistItem.findMany();
    try {
      if (existing.length > 0) {
        await prisma.verificationChecklistItem.deleteMany({});
      }

      const items = await listVerificationChecklistItems();
      expect(items).toEqual([...VERIFICATION_CHECKLIST_ITEMS]);
    } finally {
      // Restaura o estado anterior (não deixa o DB local sem a checklist seedada).
      if (existing.length > 0) {
        await prisma.verificationChecklistItem.createMany({ data: existing });
      }
    }
  });
});
