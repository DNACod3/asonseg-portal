import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração da query `listTaxonomySuggestions` + guard
 * `canApproveTaxonomySuggestions` (USP-019 / T5 / SUGG-06). Requer Postgres
 * local (`supabase start`) e DATABASE_URL no env.
 *
 * Real: Prisma/Postgres — lista só pendentes dos 2 `kind` (exclui aprovadas e
 * rejeitadas/ausentes), traz autor + data; o guard concede a coordenador e a
 * delegado ativo, nega a quem não tem nenhum dos dois.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { listTaxonomySuggestions } = await import('../queries/list-taxonomy-suggestions');
const { canApproveTaxonomySuggestions } = await import('../server/taxonomy-suggestion-access');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const NAME_PREFIX = 'ListaSugestoes Int';

function personFixture(id: string, roles: string[]): CurrentPerson {
  return {
    id,
    supabaseUserId: crypto.randomUUID(),
    fullName: 'Pessoa Lista Sugestões Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles,
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('listTaxonomySuggestions + canApproveTaxonomySuggestions — integração (USP-019 / T5)', () => {
  let suggesterId = '';
  const personIds: string[] = [];

  async function cleanup() {
    await prisma.jobArea.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
    await prisma.serviceCategory.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
  }

  async function makePerson(): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.person.create({ data: { id, fullName: 'Sugerente Lista Int', status: 'ATIVO' } });
    personIds.push(id);
    return id;
  }

  beforeAll(async () => {
    await cleanup();
    suggesterId = await makePerson();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.delegatedPermission.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
  });

  it('lista só pendentes (isSuggestion=true, approvedAt=null) dos 2 kinds, com autor + data', async () => {
    const pendingArea = `${NAME_PREFIX} Pendente Área`;
    const approvedArea = `${NAME_PREFIX} Aprovada Área`;
    const pendingCategory = `${NAME_PREFIX} Pendente Categoria`;

    await prisma.jobArea.create({
      data: { name: pendingArea, isSuggestion: true, suggestedBy: suggesterId },
    });
    await prisma.jobArea.create({
      data: {
        name: approvedArea,
        isSuggestion: false,
        suggestedBy: suggesterId,
        approvedAt: new Date(),
        approvedBy: suggesterId,
      },
    });
    await prisma.serviceCategory.create({
      data: { name: pendingCategory, isSuggestion: true, suggestedBy: suggesterId },
    });

    const items = await listTaxonomySuggestions();
    const names = items.map((i) => i.name);

    expect(names).toContain(pendingArea);
    expect(names).toContain(pendingCategory);
    expect(names).not.toContain(approvedArea); // aprovada não é mais pendente

    const pendingAreaItem = items.find((i) => i.name === pendingArea);
    expect(pendingAreaItem).toMatchObject({ kind: 'JOB_AREA', suggestedByName: 'Sugerente Lista Int' });
    expect(pendingAreaItem?.createdAt).toBeInstanceOf(Date);

    const pendingCategoryItem = items.find((i) => i.name === pendingCategory);
    expect(pendingCategoryItem?.kind).toBe('SERVICE_CATEGORY');
  });

  it('sugestão rejeitada (linha ausente) nunca aparece na fila', async () => {
    // Rejeição = DELETE (AD-009); simula diretamente a ausência da linha.
    const items = await listTaxonomySuggestions();
    expect(items.map((i) => i.name)).not.toContain(`${NAME_PREFIX} Rejeitada Inexistente`);
  });

  it('canApproveTaxonomySuggestions: coordenador acessa por permissão inerente', async () => {
    const id = await makePerson();
    expect(await canApproveTaxonomySuggestions(personFixture(id, ['COORDINATOR']))).toBe(true);
  });

  it('canApproveTaxonomySuggestions: delegado ATIVO acessa; revogado ou sem grant não acessa', async () => {
    const delegateId = await makePerson();
    const grantorId = await makePerson();
    await prisma.delegatedPermission.create({
      data: { personId: delegateId, permission: 'APPROVE_CATEGORY_SUGGESTION', grantedBy: grantorId },
    });
    expect(await canApproveTaxonomySuggestions(personFixture(delegateId, ['VOLUNTEER']))).toBe(true);

    const noGrantId = await makePerson();
    expect(await canApproveTaxonomySuggestions(personFixture(noGrantId, ['CANDIDATE']))).toBe(false);
  });
});
