'use server';

import { Prisma } from '@prisma/client';
import { getCurrentPerson } from '@/modules/identity';
import { withAudit, type AuditTx } from '@/modules/audit';
import { fail, ok, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import type { TaxonomyKind } from '../domain/taxonomy-suggestion';
import { foldForDedup } from '../domain/taxonomy-suggestion';
import { suggestTaxonomySchema, type SuggestTaxonomyInput } from '../schemas/taxonomy-suggestion';

const log = childLogger({ module: 'moderation', fn: 'suggestTaxonomy' });

const INVALID_INPUT = 'Não foi possível processar a sugestão: dados inválidos.';
const DUPLICATE_MESSAGE = 'Essa área já existe ou já foi sugerida.';

/** Erro sentinela de dedup (SUGG-MN-03) — sinaliza rollback da transação sem auditar. */
class DuplicateTaxonomyError extends Error {}

function entityTypeFor(kind: TaxonomyKind): string {
  return kind === 'JOB_AREA' ? 'job_area' : 'service_category';
}

/**
 * Lê todos os nomes existentes do `kind` (dedup — SUGG-MN-03). `JobArea` e
 * `ServiceCategory` têm forma idêntica, mas seus delegates Prisma não são
 * union-callable (assinaturas de `findMany`/`create` incompatíveis entre
 * modelos) — o `switch` explícito evita `as`/`any` mantendo o strict mode.
 */
async function findExistingNames(kind: TaxonomyKind, tx: AuditTx): Promise<{ name: string }[]> {
  switch (kind) {
    case 'JOB_AREA':
      return tx.jobArea.findMany({ select: { name: true }, take: 500 });
    case 'SERVICE_CATEGORY':
      return tx.serviceCategory.findMany({ select: { name: true }, take: 500 });
  }
}

/** Cria a linha pendente do `kind` (SUGG-01/SUGG-02) — mesmo motivo do switch acima. */
async function createSuggestion(
  kind: TaxonomyKind,
  tx: AuditTx,
  data: { name: string; isSuggestion: true; suggestedBy: string },
): Promise<{ id: string; name: string }> {
  switch (kind) {
    case 'JOB_AREA':
      return tx.jobArea.create({ data });
    case 'SERVICE_CATEGORY':
      return tx.serviceCategory.create({ data });
  }
}

/**
 * Server Action de sugestão de nova taxonomia (USP-019). Sequência canônica:
 * Zod → `getCurrentPerson()` (qualquer Pessoa ATIVA pode sugerir, sem gate de
 * papel — `fail('UNAUTHENTICATED')` em vez de `requireActivePerson`, que
 * redireciona) → `withAudit('CATEGORY_SUGGESTED', ...)` com dedup normalizado
 * dentro da transação (SUGG-MN-03) e criação pendente (`isSuggestion=true`,
 * SUGG-01/SUGG-02). Genérica por `TaxonomyKind` (SUGG-08).
 */
export async function suggestTaxonomy(input: SuggestTaxonomyInput): Promise<ActionResult<{ id: string }>> {
  const parsed = suggestTaxonomySchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', INVALID_INPUT, parsed.error.flatten().fieldErrors);

  const person = await getCurrentPerson();
  if (!person) return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');

  const { kind, name } = parsed.data;
  const cleaned = name.trim().replace(/\s+/g, ' ');
  const folded = foldForDedup(cleaned);

  try {
    const created = await withAudit(
      'CATEGORY_SUGGESTED',
      async (tx, audit) => {
        // Dedup dentro da tx (fecha a janela entre ler e escrever — SUGG-MN-03):
        // compara contra TODAS as entradas do kind (sugeridas + aprovadas).
        const existing = await findExistingNames(kind, tx);
        if (existing.some((row) => foldForDedup(row.name) === folded)) {
          throw new DuplicateTaxonomyError();
        }

        const row = await createSuggestion(kind, tx, {
          name: cleaned,
          isSuggestion: true,
          suggestedBy: person.id,
        });

        audit.entityType = entityTypeFor(kind);
        audit.entityId = row.id;
        audit.after = row;

        return row;
      },
      { actorPersonId: person.id, context: { kind } },
    );

    return ok({ id: created.id });
  } catch (err) {
    if (err instanceof DuplicateTaxonomyError) {
      return fail('CONFLICT', DUPLICATE_MESSAGE);
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Corrida de mesmo casing exato — o @unique do schema pegou primeiro.
      return fail('CONFLICT', DUPLICATE_MESSAGE);
    }
    log.error({ err, kind }, 'moderation:suggest-taxonomy:failed');
    return fail('INTERNAL', 'Não foi possível registrar a sugestão.');
  }
}
